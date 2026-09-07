// Native path for the Excel export: builds the workbook in JS (the XLSX
// library lives there) and returns its bytes as base64, leaving the actual
// save to Rust's `save_file` Tauri command.
//
// The browser sibling `download_excel.js` can't be used on mobile: it lets
// XLSX click a hidden `<a download>`, which Android System WebView drops
// without a DownloadListener and iOS WKWebView ignores outright.
//
// Sends `null` on a missing fn or a thrown error so Rust can surface a typed
// `SpaceAppError::ExcelExportFailed` rather than a silent success.
const req = await dioxus.recv();
try {
  const fn = window?.ratel?.spaces?.apps?.analyzes?.buildExcelBase64;
  if (typeof fn !== "function") {
    dioxus.send(null);
  } else {
    const b64 = await fn(req);
    dioxus.send(typeof b64 === "string" && b64.length > 0 ? b64 : null);
  }
} catch (e) {
  console.error("buildExcelBase64 failed", e);
  dioxus.send(null);
}
