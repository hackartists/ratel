//! Stores a per-user MCP client secret for authenticating MCP tool calls.
//!
//! The `secret` field stores a SHA-256 hash of the raw token. The raw token
//! is returned to the user only once at generation time and is never persisted.
//!
//! Postgres migration: the DynamoDB identity (`pk = USER#<user_id>`,
//! `sk = McpClientSecret` — one row per user; `gsi1 pk = MCS#<hashed_secret>`
//! for reverse lookup) becomes a surrogate `id` PK with `unique(user_id)` (the
//! one-per-user invariant the fixed `sk` encoded) and an indexed `secret`
//! column for the hashed-secret lookup. `user_id` keeps the `"USER#.."`
//! partition-string form — a cross-feature reference, plain column, no FK.
#![cfg(feature = "server")]

use crate::common::*;
use postgres::PostgresEntity;
use postgres::ops::StringOp;
use uuid::Uuid;

#[derive(Debug, Default, Clone, Serialize, Deserialize, PostgresEntity, PartialEq)]
#[postgres(table = "mcp_client_secrets", unique(user_id))]
pub struct McpClientSecret {
    /// Surrogate primary key (minted `now_v7` on insert when nil).
    pub id: Uuid,

    /// Owning user's partition string (`"USER#.."`). Cross-feature reference —
    /// plain column, no FK. One secret per user (`unique`).
    #[postgres(index)]
    pub user_id: String,

    /// SHA-256 hash of the raw token (URL-safe base64). Indexed for the
    /// reverse lookup that authenticates MCP requests.
    #[postgres(index)]
    pub secret: String,

    #[postgres(order)]
    pub created_at: i64,
}

impl McpClientSecret {
    /// Create a new McpClientSecret. Returns `(entity, raw_token)` where
    /// `raw_token` is the plaintext secret to show the user once.
    /// The entity stores only the SHA-256 hash.
    pub fn new(user_pk: Partition) -> (Self, String) {
        use base64::Engine;
        use sha2::Digest;

        let mut buf = [0u8; 32];
        rand::fill(&mut buf);
        let raw_token = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(buf);

        let hash = sha2::Sha256::digest(raw_token.as_bytes());
        let hashed = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(hash);

        let now = chrono::Utc::now().timestamp_millis();

        let entity = Self {
            id: Uuid::now_v7(),
            user_id: user_pk.to_string(),
            secret: hashed,
            created_at: now,
        };

        (entity, raw_token)
    }

    /// Hash a raw token for lookup.
    pub fn hash_secret(raw_token: &str) -> String {
        use base64::Engine;
        use sha2::Digest;

        let hash = sha2::Sha256::digest(raw_token.as_bytes());
        base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(hash)
    }

    /// Reverse lookup by hashed secret (replaces gsi1 `find_by_secret`).
    pub async fn find_by_secret_hash(hashed: &str) -> Result<Option<Self>> {
        Self::repository()
            .find_one(Self::query().secret(StringOp::Eq(hashed.to_string())))
            .await
            .map_err(Error::from)
    }

    /// The secret row for a user, if any (replaces `get(pk, McpClientSecret)`).
    pub async fn find_by_user(user_pk: &Partition) -> Result<Option<Self>> {
        Self::repository()
            .find_one(Self::query().user_id(StringOp::Eq(user_pk.to_string())))
            .await
            .map_err(Error::from)
    }

    /// Delete the user's secret if present; idempotent.
    pub async fn delete_for_user(user_pk: &Partition) -> Result<()> {
        if let Some(row) = Self::find_by_user(user_pk).await? {
            Self::repository().delete(row.id).await.map_err(Error::from)?;
        }
        Ok(())
    }
}
