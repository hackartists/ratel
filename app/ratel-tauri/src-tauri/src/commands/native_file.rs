//! Native file delivery for the WebView: saving a generated file, and turning
//! the current page into a PDF.
//!
//! Why this exists: the web build hands both jobs to the browser — the Excel
//! export calls `XLSX.writeFileXLSX`, which clicks a hidden `<a download>`, and
//! the report "download" calls `window.print()`. Neither browser affordance
//! exists inside a Tauri WebView:
//!
//!   * Android System WebView drops `<a download>` / `blob:` navigations unless
//!     the host app registers a `DownloadListener`, and has no print UI at all
//!     (printing needs `PrintManager` + `createPrintDocumentAdapter`).
//!   * iOS WKWebView ignores the `download` attribute without a
//!     `WKDownloadDelegate`, and `window.print()` opens nothing.
//!
//! So both buttons silently did nothing on both platforms — worse, the Excel
//! path reported success, because `writeFileXLSX` returns normally whether or
//! not anything was saved.
//!
//! `tauri-plugin-opener` can't cover this: its mobile implementations only
//! handle URLs (`Intent.ACTION_VIEW` with no FileProvider on Android,
//! `UIApplication.open` on iOS), so a local file path never reaches a viewer.
//!
//! Both commands reach the platform through `window.with_webview`, which hands
//! back a JNI handle on Android and the raw `WKWebView` on iOS. The native side
//! lives next to the other custom host code (`MainActivity.kt`, `RatelFiles.m`).
//! Because that dispatch is fire-and-forget onto the UI thread, each command
//! blocks on a channel so the WebView caller still learns whether the hand-off
//! actually happened instead of assuming it did.

use std::sync::mpsc;
use std::time::Duration;

use serde::Serialize;
use tauri::Manager;

/// How long to wait for the UI thread to report back. Generous: the Android
/// path writes the whole file through `MediaStore` before answering, and the
/// iOS path renders a PDF of the page. Exceeding it is reported as a failure
/// rather than a hang.
const NATIVE_CALL_TIMEOUT: Duration = Duration::from_secs(30);

#[derive(Serialize)]
pub struct NativeFileResponse {
    /// `true` only when the platform actually took the file — saved it, or put
    /// it in front of the user in a share sheet. Never optimistic.
    pub ok: bool,
    /// Empty on success; a short reason the caller can surface otherwise.
    pub error: String,
}

impl NativeFileResponse {
    fn ok() -> Self {
        Self {
            ok: true,
            error: String::new(),
        }
    }

    fn err(msg: impl Into<String>) -> Self {
        Self {
            ok: false,
            error: msg.into(),
        }
    }
}

/// Save `body_b64` (base64, same convention as `s3_put_object` — raw binary
/// can't cross the JS invoke bridge) as `file_name` and hand it to the user.
///
/// "Hand to the user" is deliberately per-platform, because the platforms
/// disagree about what a download is:
///   * Android ≥ 29 writes into the shared Downloads collection, so the file
///     shows up where a browser download would.
///   * Android < 29 (this app still ships `minSdk 24`) has no scoped-storage
///     Downloads API, so it falls back to a share sheet.
///   * iOS has no user-visible Downloads folder at all; the share sheet's
///     "Save to Files" is the platform's answer.
#[tauri::command]
pub async fn save_file(
    app: tauri::AppHandle,
    file_name: String,
    mime_type: String,
    body_b64: String,
) -> Result<NativeFileResponse, String> {
    let Some(window) = app.get_webview_window("main") else {
        return Ok(NativeFileResponse::err("no main webview window"));
    };

    #[cfg(target_os = "android")]
    {
        let (tx, rx) = mpsc::channel::<Result<(), String>>();
        // The closure must NOT block: it already runs on the Android UI
        // thread, and `jni_handle().exec` only queues work for that same
        // thread. Waiting here would stall the thread that has to run the
        // queued job — a self-deadlock. So hand the sender down and wait on
        // this (non-UI) command thread instead.
        let res = window.with_webview(move |webview| {
            android::save_file(&webview, file_name, mime_type, body_b64, tx);
        });
        if let Err(e) = res {
            return Ok(NativeFileResponse::err(format!("with_webview failed: {e}")));
        }
        return Ok(recv_outcome(rx));
    }

    #[cfg(target_os = "ios")]
    {
        let (tx, rx) = mpsc::channel::<Result<(), String>>();
        let res = window.with_webview(move |webview| {
            let outcome = ios::save_file(&webview, &file_name, &body_b64);
            let _ = tx.send(outcome);
        });
        if let Err(e) = res {
            return Ok(NativeFileResponse::err(format!("with_webview failed: {e}")));
        }
        return Ok(recv_outcome(rx));
    }

    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        // Desktop hosts still build this crate (`cargo check` on macOS). The
        // web/desktop callers keep using the browser download path, so this
        // arm is only reachable by mistake — say so instead of pretending.
        let _ = (window, file_name, mime_type, body_b64);
        Ok(NativeFileResponse::err("save_file is mobile-only"))
    }
}

/// Render the currently displayed page to a PDF and hand it to the user.
///
/// Replaces `window.print()`, which is a no-op in both mobile WebViews.
#[tauri::command]
pub async fn print_page(
    app: tauri::AppHandle,
    job_name: String,
) -> Result<NativeFileResponse, String> {
    let Some(window) = app.get_webview_window("main") else {
        return Ok(NativeFileResponse::err("no main webview window"));
    };

    #[cfg(target_os = "android")]
    {
        let (tx, rx) = mpsc::channel::<Result<(), String>>();
        // See the note in `save_file` — never block inside this closure.
        let res = window.with_webview(move |webview| {
            android::print_page(&webview, job_name, tx);
        });
        if let Err(e) = res {
            return Ok(NativeFileResponse::err(format!("with_webview failed: {e}")));
        }
        return Ok(recv_outcome(rx));
    }

    #[cfg(target_os = "ios")]
    {
        let (tx, rx) = mpsc::channel::<Result<(), String>>();
        let res = window.with_webview(move |webview| {
            let outcome = ios::print_page(&webview, &job_name);
            let _ = tx.send(outcome);
        });
        if let Err(e) = res {
            return Ok(NativeFileResponse::err(format!("with_webview failed: {e}")));
        }
        return Ok(recv_outcome(rx));
    }

    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        let _ = (window, job_name);
        Ok(NativeFileResponse::err("print_page is mobile-only"))
    }
}

#[cfg(any(target_os = "android", target_os = "ios"))]
fn recv_outcome(rx: mpsc::Receiver<Result<(), String>>) -> NativeFileResponse {
    match rx.recv_timeout(NATIVE_CALL_TIMEOUT) {
        Ok(Ok(())) => NativeFileResponse::ok(),
        Ok(Err(e)) => NativeFileResponse::err(e),
        Err(e) => NativeFileResponse::err(format!("native call did not answer: {e}")),
    }
}

// ── Android ───────────────────────────────────────────────────────────────
//
// `jni_handle().exec` dispatches onto the Android UI thread and gives us the
// JNI env plus the running Activity — our `MainActivity`, which carries the
// `ratelSaveFile` / `ratelPrintPage` methods. Calling Kotlin from here (rather
// than reimplementing MediaStore/PrintManager over raw JNI) keeps the Android
// specifics in Kotlin where they are readable.
#[cfg(target_os = "android")]
mod android {
    use std::sync::mpsc::Sender;

    use jni::objects::JValue;

    /// Queue a `(String…) -> Boolean` call on `MainActivity` and report the
    /// outcome through `tx`.
    ///
    /// Returns as soon as the work is queued — `exec` runs it on the UI thread
    /// afterwards, so blocking here (we are already on that thread) would
    /// deadlock. Every JNI failure mode is folded into the error string rather
    /// than unwrapped: a panic would cross the FFI boundary on the UI thread.
    fn call_activity_bool(
        webview: &tauri::webview::PlatformWebview,
        method: &'static str,
        signature: &'static str,
        args: Vec<String>,
        tx: Sender<Result<(), String>>,
    ) {
        let method_name = method;
        let sig = signature;

        webview.jni_handle().exec(move |env, activity, _webview| {
            let mut jstrings = Vec::with_capacity(args.len());
            for arg in &args {
                match env.new_string(arg) {
                    Ok(s) => jstrings.push(s),
                    Err(e) => {
                        let _ = tx.send(Err(format!("jni new_string: {e}")));
                        return;
                    }
                }
            }
            let values: Vec<JValue> = jstrings.iter().map(JValue::from).collect();

            match env.call_method(activity, method_name, sig, &values) {
                Ok(v) => match v.z() {
                    Ok(true) => {
                        let _ = tx.send(Ok(()));
                    }
                    Ok(false) => {
                        let _ = tx.send(Err(format!("{method_name} returned false")));
                    }
                    Err(e) => {
                        let _ = tx.send(Err(format!("{method_name} bad return: {e}")));
                    }
                },
                Err(e) => {
                    // A pending Java exception would poison every later JNI
                    // call on this thread, so clear it before returning.
                    let _ = env.exception_clear();
                    let _ = tx.send(Err(format!("{method_name} threw: {e}")));
                }
            }
        });
    }

    pub fn save_file(
        webview: &tauri::webview::PlatformWebview,
        file_name: String,
        mime_type: String,
        body_b64: String,
        tx: Sender<Result<(), String>>,
    ) {
        call_activity_bool(
            webview,
            "ratelSaveFile",
            "(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;)Z",
            vec![file_name, mime_type, body_b64],
            tx,
        )
    }

    pub fn print_page(
        webview: &tauri::webview::PlatformWebview,
        job_name: String,
        tx: Sender<Result<(), String>>,
    ) {
        call_activity_bool(
            webview,
            "ratelPrintPage",
            "(Ljava/lang/String;)Z",
            vec![job_name],
            tx,
        )
    }
}

// ── iOS ───────────────────────────────────────────────────────────────────
//
// The UIKit work (write to Documents, present a share sheet, render the
// WKWebView to PDF) lives in `RatelFiles.m` next to `RatelPush.m`, and is
// reached through plain C symbols resolved at final link. Doing it in
// Objective-C rather than through objc2 keeps the UIKit call sequence — which
// includes an iPad-only popover anchor that crashes if omitted — in one
// readable place.
#[cfg(target_os = "ios")]
mod ios {
    use std::ffi::{c_char, c_void, CString};

    // The two entry points are resolved at RUNTIME rather than declared as
    // link-time `extern "C"` imports.
    //
    // Why: this crate builds as a cdylib (`-dynamiclib -nodefaultlibs`), and
    // `RatelFiles.m` is compiled later, into the Xcode app target that links
    // *against* this dylib. A plain `extern "C"` block therefore fails the
    // dylib's own link step with "Undefined symbols: _ratel_save_and_share".
    // By the time these run, the app binary is loaded in this process and
    // `RTLD_DEFAULT` finds them.
    //
    // A missing symbol degrades to a typed error instead of a crash, which
    // also covers the case where someone builds the Rust side without the
    // Objective-C file.

    /// `RTLD_DEFAULT` on Apple platforms — search every loaded image, starting
    /// with the main executable (which is where `RatelFiles.o` lives).
    const RTLD_DEFAULT: *mut c_void = -2isize as *mut c_void;

    unsafe extern "C" {
        fn dlsym(handle: *mut c_void, symbol: *const c_char) -> *mut c_void;
    }

    type SaveFn = unsafe extern "C" fn(*const c_char, *const c_char, *mut c_void) -> bool;
    type PrintFn = unsafe extern "C" fn(*const c_char, *mut c_void) -> bool;

    fn lookup(symbol: &str) -> Result<*mut c_void, String> {
        let name = c(symbol)?;
        let ptr = unsafe { dlsym(RTLD_DEFAULT, name.as_ptr()) };
        if ptr.is_null() {
            return Err(format!("{symbol} not found in the app binary"));
        }
        Ok(ptr)
    }

    fn c(s: &str) -> Result<CString, String> {
        CString::new(s).map_err(|e| format!("bad C string: {e}"))
    }

    pub fn save_file(
        webview: &tauri::webview::PlatformWebview,
        file_name: &str,
        body_b64: &str,
    ) -> Result<(), String> {
        let name = c(file_name)?;
        let body = c(body_b64)?;
        let sym = lookup("ratel_save_and_share")?;
        let f: SaveFn = unsafe { std::mem::transmute(sym) };
        let ok = unsafe { f(name.as_ptr(), body.as_ptr(), webview.inner() as *mut c_void) };
        if ok {
            Ok(())
        } else {
            Err("ratel_save_and_share failed".to_string())
        }
    }

    pub fn print_page(
        webview: &tauri::webview::PlatformWebview,
        job_name: &str,
    ) -> Result<(), String> {
        let name = c(job_name)?;
        let sym = lookup("ratel_print_webview")?;
        let f: PrintFn = unsafe { std::mem::transmute(sym) };
        let ok = unsafe { f(name.as_ptr(), webview.inner() as *mut c_void) };
        if ok {
            Ok(())
        } else {
            Err("ratel_print_webview failed".to_string())
        }
    }
}
