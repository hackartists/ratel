// app/ratel/src/features/cross_posting/interop/redirect.rs +
// web/redirect_external.js — top-level navigation out of the SPA (OAuth
// consent pages). A router push would stay inside the app.
export function redirectToExternal(url: string): void {
  if (typeof url === "string" && url.length > 0) {
    window.location.href = url;
  }
}
