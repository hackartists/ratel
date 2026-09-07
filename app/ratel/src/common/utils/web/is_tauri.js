// Whether this page is running inside a Tauri WebView.
//
// The `tauri-web` Cargo feature is NOT a usable discriminator here: the web
// fullstack build enables it too (that's why `invoke_tauri.js` carries a
// browser `fetch` fallback), so `cfg!(feature = "tauri-web")` is true in both
// builds. Asking the page is the only honest test — and it matches how the
// existing Tauri bridge already decides.
dioxus.send(
  typeof window !== "undefined" &&
    !!window.__TAURI_INTERNALS__ &&
    typeof window.__TAURI_INTERNALS__.invoke === "function"
);
