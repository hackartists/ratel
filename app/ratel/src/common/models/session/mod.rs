#[cfg(feature = "server")]
use postgres::{PostgresEntity, PostgresJson};

/// Opaque jsonb wrapper for the serialized tower-sessions `Record`. serde
/// treats a single-field tuple newtype transparently, so the column holds the
/// bare JSON document (no wrapper key).
#[cfg(feature = "server")]
#[derive(Debug, Default, Clone, serde::Serialize, serde::Deserialize, PartialEq, PostgresJson)]
pub struct SessionData(pub serde_json::Value);

#[cfg(feature = "server")]
#[derive(Debug, Default, Clone, serde::Serialize, serde::Deserialize, PartialEq, PostgresEntity)]
#[postgres(table = "sessions")]
pub struct Session {
    /// tower-sessions session id (external string PK).
    pub id: String,
    #[postgres(order)]
    pub created_at: i64,
    pub updated_at: i64,
    /// Serialized tower-sessions `Record` — opaque jsonb.
    pub data: SessionData,
    pub expires_at: i64,
}

#[cfg(feature = "server")]
impl Session {
    /// Stamps `created_at`/`updated_at` to now in **microseconds**
    /// (`timestamp_micros`) — tower-sessions rows are written far more often
    /// than once a second, and `created_at` is the `#[postgres(order)]` key.
    pub fn new(id: String, expires_at: i64, data: SessionData) -> Self {
        let now = chrono::Utc::now().timestamp_micros();
        Self {
            id,
            created_at: now,
            updated_at: now,
            data,
            expires_at,
        }
    }
}

#[cfg(feature = "server")]
pub use tower_sessions::Session as TowerSession;
