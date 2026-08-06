// Direct Tauri IPC invoke, bypassing the `window.ratel` JS dispatch table
// (which only routes method names that exist as functions on `window.ratel`).
// Used by the tauri-web HTTP transport to call the native `api_request`
// command, so API calls go through a native reqwest cookie jar instead of the
// in-WebView fetch — iOS WKWebView (ITP) strips the cross-site session cookie.
//
// Plain-web fallback: in a normal browser there is no Tauri IPC
// (`window.__TAURI_INTERNALS__` is undefined). The native `api_request`
// command is just an HTTP call, so when Tauri isn't present we perform the
// request with the in-page `fetch` (same-origin, credentials included so the
// session cookie rides along). This keeps the web build working while the
// Tauri/iOS build still routes through the native cookie-jar transport.
const { method, args } = await dioxus.recv();

const hasTauri =
  typeof window !== "undefined" &&
  window.__TAURI_INTERNALS__ &&
  typeof window.__TAURI_INTERNALS__.invoke === "function";

if (hasTauri) {
  try {
    const res = await window.__TAURI_INTERNALS__.invoke(method, args);
    dioxus.send(res);
  } catch (e) {
    console.error(`tauri invoke ${method} failed`, e);
    dioxus.send(null);
  }
} else if (method === "api_request") {
  // args = { method, url, body }  → mirrors the native ApiResponse { status, body }.
  // The web fullstack build serves the app AND `/api/*` from the same origin, so
  // ignore the compile-time absolute `api_base_url()` host (baked for the mobile
  // build) and fetch the path + query same-origin — otherwise the browser blocks
  // the cross-origin call to dev.ratel.foundation on CORS.
  try {
    let target = args.url;
    try {
      const u = new URL(args.url);
      target = u.pathname + u.search;
    } catch (_) {
      /* already relative */
    }
    const init = { method: args.method, credentials: "include", headers: {} };
    if (args.body != null) {
      init.headers["content-type"] = "application/json";
      init.body = args.body;
    }
    const res = await fetch(target, init);
    const body = await res.text();
    dioxus.send({ status: res.status, body });
  } catch (e) {
    console.error(`web fetch api_request failed`, e);
    dioxus.send(null);
  }
} else {
  // A non-api_request native method with no Tauri available — nothing to do.
  dioxus.send(null);
}
