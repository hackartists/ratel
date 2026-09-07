//! Turning a notification's stored `cta_url` into something safe to hand
//! `nav.push`.
//!
//! `cta_url`s are persisted **absolute** (e.g.
//! `https://ratel.foundation/spaces/…`) because the same payload also feeds
//! email links, which need a full URL. See `build_space_url` /
//! `SpaceAction::get_cta_url`.
//!
//! But `dioxus-router` classifies anything it can't match as an internal route
//! into `NavigationTarget::External` (`dioxus-router/src/navigation.rs`), and an
//! absolute URL never matches. `nav.push(cta_url)` therefore performs a
//! **full-page navigation** rather than an SPA push.
//!
//! On the Tauri shell that is a session-losing bug, not just a slow navigation:
//! the WebView leaves the embedded bundle (`tauri.localhost`) and loads the
//! remote web build, where the whole tauri-web layer is inert — FCM
//! registration, and crucially the native `api_request` transport that owns the
//! reqwest cookie jar holding the session. The remote page falls back to the
//! WebView's own (empty) cookie store, so the user lands on the target screen
//! signed out.
//!
//! Stripping `scheme://host` keeps the tap inside the SPA. On web it is a
//! same-origin URL either way, so the strip only upgrades a full reload into an
//! SPA navigation.

/// Convert a notification `cta_url` into an in-app **relative** route.
///
/// Already-relative inputs (e.g. `/spaces/{id}`) pass through unchanged; a
/// bare path gains a leading slash.
pub fn deep_link_path(url: &str) -> String {
    if let Some(rest) = url
        .strip_prefix("https://")
        .or_else(|| url.strip_prefix("http://"))
    {
        // Drop `scheme://host`, keep the path (+ query / fragment).
        match rest.find('/') {
            Some(i) => rest[i..].to_string(),
            None => "/".to_string(),
        }
    } else if url.starts_with('/') {
        url.to_string()
    } else {
        format!("/{url}")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_scheme_and_host() {
        assert_eq!(
            deep_link_path("https://ratel.foundation/spaces/abc"),
            "/spaces/abc"
        );
        assert_eq!(
            deep_link_path("http://dev.ratel.foundation/spaces/abc?tab=polls#c1"),
            "/spaces/abc?tab=polls#c1"
        );
    }

    /// A host with no path must not become the empty string — `nav.push("")`
    /// is not a route.
    #[test]
    fn bare_host_becomes_root() {
        assert_eq!(deep_link_path("https://ratel.foundation"), "/");
    }

    #[test]
    fn relative_inputs_pass_through() {
        assert_eq!(deep_link_path("/spaces/abc"), "/spaces/abc");
        assert_eq!(deep_link_path("spaces/abc"), "/spaces/abc");
    }
}
