// app/ratel/src/common/hooks/use_origin.rs — the origin shown to the user in
// copyable URLs (the MCP endpoint, share links). The Tauri WebView's own origin
// (`tauri.localhost`) is not reachable from outside, so that build uses the
// configured backend base URL instead, like the Rust `tauri-web` branch.
export function useOrigin(): string {
  if (import.meta.env.VITE_TAURI === "1") {
    return import.meta.env.VITE_MOBILE_API_URL ?? "https://dev.ratel.foundation";
  }
  return typeof window === "undefined" ? "" : window.location.origin;
}
