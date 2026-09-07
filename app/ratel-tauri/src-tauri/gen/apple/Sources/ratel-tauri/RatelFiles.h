#import <Foundation/Foundation.h>

/// iOS file-delivery bridge for the Tauri WebView app.
///
/// WKWebView ignores `<a download>` without a `WKDownloadDelegate`, and
/// `window.print()` opens nothing at all — so the Excel export and the report
/// "download" both did nothing in the shipped app. Rust's
/// `commands/native_file.rs` calls these two C entry points instead (resolved
/// at final link, the same way `main.mm` reaches `RatelPush`).
///
/// Both run on the UI thread — `window.with_webview` already dispatches there —
/// and return synchronously so the WebView caller gets a real answer rather
/// than an optimistic one.
///
/// iOS has no user-visible Downloads folder, so "delivering" a file means
/// writing it to the app's temp directory and presenting a share sheet, whose
/// "Save to Files" is the platform's equivalent of a browser download.

#ifdef __cplusplus
extern "C" {
#endif

/// Decode `bodyB64`, write it as `fileName`, and present a share sheet for it.
/// `webview` is the `WKWebView *`, used to locate the presenting controller.
/// Returns NO if decoding, writing, or presentation fails.
BOOL ratel_save_and_share(const char *fileName, const char *bodyB64, void *webview);

/// Render the WKWebView's current page to a PDF named `jobName` and present a
/// share sheet for it. Uses the view print formatter (not `createPDF…`) so the
/// page's `@media print` rules apply, matching both the web build and the
/// Android `createPrintDocumentAdapter` path. Returns NO on failure.
BOOL ratel_print_webview(const char *jobName, void *webview);

#ifdef __cplusplus
}
#endif
