//! On-startup session restore via refresh token.
//!
//! After a successful login the client stashed `(refresh_token,
//! device_id)` in the WebView's `localStorage`. When the app restarts the
//! in-memory reqwest cookie jar is gone, so the next call to
//! `get_me_handler` would 401. This helper runs *before* `get_me` and
//! exchanges the cached refresh token for a fresh server session cookie
//! so the rest of the boot path can pretend the user never logged out.
//!
//! Failure modes:
//!   - No cached creds → no-op (user was anonymous; `get_me` will return
//!     `None` and we render signed-out).
//!   - Cached creds but server rejects them (revoked, expired, rotated
//!     elsewhere) → wipe the cache so we don't keep hammering the server.

use crate::common::utils::storage;
use crate::features::auth::controllers::{
    refresh_session_handler, RefreshSessionRequest,
};
use crate::features::auth::services::device_id;

pub const REFRESH_TOKEN_STORAGE_KEY: &str = "refresh_token";

pub fn save_refresh_token(token: &str) {
    storage::save(REFRESH_TOKEN_STORAGE_KEY, token);
}

pub fn clear_refresh_token() {
    storage::remove(REFRESH_TOKEN_STORAGE_KEY);
}

/// The stable device id to attach to a login/signup request, so the server
/// mints a refresh token for this install.
///
/// `Some` only on the native mobile shell. Web and desktop keep the session in
/// the browser's own cookie jar, which already survives restarts (30-day
/// expiry, see `get_session_layer`); handing those targets a second long-lived
/// credential in `localStorage` would widen the XSS blast radius for nothing —
/// `try_restore_session` never runs there.
pub async fn login_device_id() -> Option<String> {
    #[cfg(feature = "tauri-web")]
    {
        crate::features::auth::services::device_id::get_or_create().await
    }
    #[cfg(not(feature = "tauri-web"))]
    {
        None
    }
}

/// Persist the refresh token a login/signup response carried, if any.
///
/// Pair with [`login_device_id`] at every call site that authenticates: without
/// the saved token the next app launch has nothing to exchange and the user
/// lands back on the login screen.
pub fn remember_refresh_token(token: Option<&String>) {
    if let Some(token) = token {
        save_refresh_token(token);
    }
}

/// Best-effort restore. Always safe to call — never throws to the caller.
/// Logs the outcome under `RatelRust` so failures show up in `adb
/// logcat` during debugging.
pub async fn try_restore_session() {
    let Some(refresh_token) = storage::load(REFRESH_TOKEN_STORAGE_KEY).await else {
        return;
    };
    let Some(device_id) = device_id::get_or_create().await else {
        return;
    };

    match refresh_session_handler(RefreshSessionRequest {
        refresh_token,
        device_id,
    })
    .await
    {
        Ok(resp) => {
            // Token rotation: overwrite the saved token with the fresh
            // one so the next boot has a valid handle.
            save_refresh_token(&resp.refresh_token);
            crate::debug!("session restored from refresh token");
        }
        Err(e) => {
            crate::error!("refresh failed, clearing cached token: {e}");
            clear_refresh_token();
        }
    }
}
