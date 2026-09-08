//! Delivering a generated file (or the current page as a PDF) to the user.
//!
//! On the web the browser does this for us: `<a download>` saves a blob, and
//! `window.print()` opens a print dialog with a "Save as PDF" destination.
//! Neither exists inside the Tauri WebView — Android System WebView drops
//! `<a download>` unless the host registers a `DownloadListener` and has no
//! print UI at all; iOS WKWebView ignores the `download` attribute without a
//! `WKDownloadDelegate` and opens nothing for `print()`. Both mobile builds
//! therefore did nothing when the user tapped Excel export or report download,
//! and the Excel path even reported success.
//!
//! This module is the fork: on the native shell it hands the job to the
//! `save_file` / `print_page` Tauri commands (which reach `MainActivity.kt` and
//! `RatelFiles.m`); everywhere else the caller keeps the browser path.
//!
//! Callers should branch on [`has_native_file_delivery`] rather than on a
//! feature flag, so the intent reads at the call site.

/// Whether this page is running inside the native shell, and should therefore
/// hand files to the platform instead of the browser.
///
/// Asked of the page at runtime, NOT derived from a Cargo feature. The obvious
/// `cfg!(feature = "tauri-web")` is wrong here: the web fullstack build enables
/// `tauri-web` as well — which is exactly why `invoke_tauri.js` ships a browser
/// `fetch` fallback — so the flag is true in both builds. Gating on it put the
/// native branch into the web bundle and dropped the browser one (caught by
/// diffing the built wasm against the deployed site: `window.print` and
/// `downloadExcel` had vanished from it).
pub async fn is_native_shell() -> bool {
    #[cfg(feature = "server")]
    {
        false
    }

    #[cfg(not(feature = "server"))]
    {
        let mut runner = dioxus::document::eval(include_str!("web/is_tauri.js"));
        runner.recv::<bool>().await.unwrap_or(false)
    }
}

/// Save `bytes` as `file_name` and put it in front of the user.
///
/// Where it lands is the platform's business — Android ≥ 29 writes it into the
/// shared Downloads collection, older Android and iOS present a share sheet
/// ("Save to Files" being iOS's equivalent of a download). What matters here is
/// that `Ok(())` means the platform actually took the file: the command reports
/// the native return value rather than assuming success.
pub async fn save_file(file_name: &str, mime_type: &str, bytes: &[u8]) -> crate::common::Result<()> {
    use base64::Engine;

    // Base64 for the same reason `s3_put_object` uses it: raw binary does not
    // cross the JS invoke bridge cleanly.
    let body_b64 = base64::engine::general_purpose::STANDARD.encode(bytes);
    let resp: NativeFileResponse = crate::common::utils::web::invoke_tauri(
        "save_file",
        serde_json::json!({
            "fileName": file_name,
            "mimeType": mime_type,
            "bodyB64": body_b64,
        }),
    )
    .await?;
    resp.into_result("save_file")
}

/// Render the current page to a PDF named `job_name` and hand it to the user.
pub async fn print_page(job_name: &str) -> crate::common::Result<()> {
    let resp: NativeFileResponse = crate::common::utils::web::invoke_tauri(
        "print_page",
        serde_json::json!({ "jobName": job_name }),
    )
    .await?;
    resp.into_result("print_page")
}

/// Mirror of `ratel_tauri_lib::commands::native_file::NativeFileResponse`.
#[derive(serde::Deserialize)]
struct NativeFileResponse {
    ok: bool,
    error: String,
}

impl NativeFileResponse {
    /// Keep the native reason in the log (it names the failing JNI/UIKit step)
    /// and give the caller a plain error to translate for the user.
    fn into_result(self, what: &str) -> crate::common::Result<()> {
        if self.ok {
            return Ok(());
        }
        crate::error!("{what} failed natively: {}", self.error);
        Err(crate::common::Error::OnlyWebFunction)
    }
}