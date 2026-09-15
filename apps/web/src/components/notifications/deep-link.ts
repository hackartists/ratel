// app/ratel/src/features/notifications/deep_link.rs — turning a notification's
// stored `cta_url` into an in-app route.
//
// `cta_url`s are persisted absolute (`https://ratel.foundation/spaces/…`)
// because the same payload feeds email links. Navigating to an absolute URL
// is a full-page load; on the Tauri shell that leaves the embedded bundle for
// the remote web build, where the native `api_request` transport (and the
// session cookie jar it owns) is gone, so the user lands signed out. Stripping
// `scheme://host` keeps the tap an SPA navigation; on the web it only upgrades
// a same-origin reload into an SPA push.

/**
 * Rust `deep_link_path`: an absolute `http(s)://` URL loses its scheme and
 * host (keeping path, query and fragment; a bare host becomes `/`),
 * already-relative inputs pass through, and a bare path gains a leading slash.
 */
export function deepLinkPath(url: string): string {
  const rest = url.startsWith("https://")
    ? url.slice("https://".length)
    : url.startsWith("http://")
      ? url.slice("http://".length)
      : null;
  if (rest !== null) {
    const slash = rest.indexOf("/");
    return slash >= 0 ? rest.slice(slash) : "/";
  }
  return url.startsWith("/") ? url : `/${url}`;
}
