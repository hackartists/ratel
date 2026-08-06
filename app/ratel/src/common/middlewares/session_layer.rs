use async_trait::async_trait;
use chrono::Utc;
use tower_sessions::{
    SessionManagerLayer, SessionStore,
    cookie::time::{Duration, OffsetDateTime},
    session::{Id, Record},
    session_store,
};

use crate::common::models::session::{Session as SessionEntity, SessionData};

pub fn get_session_layer(env: String) -> SessionManagerLayer<PostgresSessionStore> {
    let session_store = PostgresSessionStore;

    // Cookie config has to satisfy three contexts:
    //
    //   * web Playwright job: same-origin browser ↔ backend at
    //     `http://localhost:8080`.
    //   * Tauri Android smoke: WebView at `http://tauri.localhost`
    //     ↔ backend at `http://localhost:8080`. Different "sites"
    //     (no public-suffix entry for `.localhost`), so the cookie
    //     must be `SameSite=None` to survive the cross-site XHR.
    //   * Production: HTTPS cross-origin from `*.ratel.foundation`
    //     to the API. Needs `SameSite=None; Secure`.
    //
    // `SameSite=None; Secure` works in all three. Chromium treats
    // every `*.localhost` host as a secure context, so the `Secure`
    // attribute does not block the cookie over HTTP loopback. The
    // smoke run confirmed this with CDP `responseReceivedExtraInfo`:
    // once `setAcceptThirdPartyCookies(webview, true)` was wired up
    // in MainActivity, the only remaining blocked reason was
    // `SameSiteNoneInsecure` — which `Secure=true` resolves.
    //
    // `HttpOnly=false` is kept (was `!is_local` before) — no client
    // code reads the session cookie via JS, but leaving the door
    // open is harmless on every target we care about and useful for
    // CDP-based diagnostics on the smoke job.
    let layer = SessionManagerLayer::new(session_store)
        .with_secure(true)
        .with_http_only(false)
        .with_same_site(tower_sessions::cookie::SameSite::None)
        .with_name(format!("{}_sid", env))
        .with_path("/")
        .with_expiry(tower_sessions::Expiry::AtDateTime(
            OffsetDateTime::now_utc()
                .checked_add(Duration::days(30))
                .unwrap(),
        ));

    layer
}

/// Zero-sized `tower-sessions` store backed by the [`SessionEntity`] Postgres
/// entity. Every call resolves the process-global pool through
/// `Session::repository()`, so the store carries no state.
#[derive(Debug, Clone, Copy, Default)]
pub struct PostgresSessionStore;

#[async_trait]
impl SessionStore for PostgresSessionStore {
    async fn create(&self, session_record: &mut Record) -> session_store::Result<()> {
        // tower-sessions invokes `create` once when minting a new session and
        // expects us to persist it. The 128-bit id space makes collisions
        // effectively unreachable, so we don't probe.
        self.save(session_record).await
    }

    async fn save(&self, session_record: &Record) -> session_store::Result<()> {
        let data = session_data_from_record(session_record)?;
        SessionEntity::new(
            session_record.id.to_string(),
            session_record.expiry_date.unix_timestamp(),
            data,
        )
        .upsert()
        .await
        .map_err(|e| session_store::Error::Backend(format!("pg put session: {e}")))?;
        Ok(())
    }

    async fn load(&self, session_id: &Id) -> session_store::Result<Option<Record>> {
        let Some(s) = SessionEntity::get_by_id(session_id.to_string())
            .await
            .map_err(|e| session_store::Error::Backend(format!("pg get session: {e}")))?
        else {
            return Ok(None);
        };

        // Defense in depth — even if the TTL sweeper is lagging behind, never
        // hand back an expired record.
        if s.expires_at <= Utc::now().timestamp() {
            return Ok(None);
        }

        // Only `record.data` is stored in the jsonb column; rebuild the full
        // `Record` from the row's first-class `id` / `expires_at` columns.
        let data = serde_json::from_value(s.data.0).map_err(|e| {
            session_store::Error::Decode(format!("Failed to deserialize session data: {e}"))
        })?;
        let expiry_date = OffsetDateTime::from_unix_timestamp(s.expires_at).map_err(|e| {
            session_store::Error::Decode(format!("Failed to deserialize session expiry: {e}"))
        })?;
        let record = Record {
            id: *session_id,
            data,
            expiry_date,
        };
        Ok(Some(record))
    }

    async fn delete(&self, session_id: &Id) -> session_store::Result<()> {
        // `delete_by_id` returns the deleted row or `Error::NotFound`. Logout
        // should be idempotent, so swallow the "missing" case but propagate
        // everything else.
        match SessionEntity::delete_by_id(session_id.to_string()).await {
            Ok(_) => Ok(()),
            Err(postgres::Error::NotFound) => Ok(()),
            Err(e) => Err(session_store::Error::Backend(format!(
                "pg delete session: {e}"
            ))),
        }
    }
}

/// Serialize the tower-sessions `Record` payload into the opaque jsonb column.
///
/// The full `Record` cannot be round-tripped through JSON: `Record.id` is an
/// i128 that falls outside JSON's safe integer range, and both `id` and
/// `expiry_date` are already stored as first-class columns. We persist only
/// `record.data` and rebuild the `Record` on load from the row's columns.
fn session_data_from_record(record: &Record) -> session_store::Result<SessionData> {
    serde_json::to_value(&record.data)
        .map(SessionData)
        .map_err(|e| session_store::Error::Encode(format!("Failed to serialize session data: {e}")))
}
