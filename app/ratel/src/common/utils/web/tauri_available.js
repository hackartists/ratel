// Returns true iff the Tauri IPC bridge is present — i.e. the bundle is
// actually running inside the Tauri WebView. In a plain browser (including a
// mis-deployed tauri-web bundle served over http), window.__TAURI_INTERNALS__
// is undefined, so the native `invoke` would throw. The Rust caller uses this
// to decide between the native `s3_put_object` command and a direct fetch PUT.
dioxus.send(
  typeof window.__TAURI_INTERNALS__ !== "undefined" &&
    window.__TAURI_INTERNALS__ !== null,
);
