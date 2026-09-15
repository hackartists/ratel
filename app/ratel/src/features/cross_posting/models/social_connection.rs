use crate::common::*;
use crate::features::cross_posting::types::SocialPlatform;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;
use uuid::Uuid;

#[cfg(feature = "server")]
use postgres::{PostgresEntity, PostgresJson};

/// Opaque AEAD-sealed credential blob. Postgres has no native `Vec<u8>`
/// column codec in this ORM, so the byte blob is stored as a JSONB newtype
/// (serde treats a single-field tuple newtype transparently). The bytes are
/// never inspected in SQL — only sealed/opened by `services::credentials`.
#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "server", derive(PostgresJson))]
pub struct CredentialCiphertext(pub Vec<u8>);

/// Per-user, per-platform external account credential. KMS-encrypted.
///
/// Postgres migration: surrogate `id` PK; the DynamoDB single-table
/// `(User(user_id), SocialConnection(platform))` identity becomes the
/// `unique(user_id, platform)` natural key. `user_id` is a cross-feature
/// reference to the auth `User` entity — stored as a plain String (the bare
/// user id), **no** FK for now.
///
/// Design doc: docs/superpowers/specs/2026-04-28-cross-posting-design.md
/// (`SocialConnection` section). FR-1 #1–#7.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(PostgresEntity))]
#[cfg_attr(
    feature = "server",
    postgres(table = "social_connections", unique(user_id, platform))
)]
pub struct SocialConnection {
    pub id: Uuid,

    /// Cross-feature reference to the auth `User` (bare user id). Indexed so
    /// the connections list / factory can query all rows for one user.
    #[cfg_attr(feature = "server", postgres(index))]
    pub user_id: String,

    pub platform: SocialPlatform,

    /// `"{platform}#{status}"`. Was the sparse gsi1 sort key on DynamoDB —
    /// kept as an indexed column so a "all Connected linkedin users" sweep
    /// stays a single-index query.
    #[cfg_attr(feature = "server", postgres(index))]
    pub platform_status: String,

    pub status: ConnectionStatus,

    pub external_handle: String,
    pub external_user_id: String,

    /// AEAD-sealed credential blob (`crate::common::utils::aead::seal`).
    /// Bluesky: app-password session JWTs (accessJwt + refreshJwt + did).
    /// LinkedIn / Threads: OAuth access + refresh tokens.
    /// Decrypted only inside the dispatcher. The blob's first byte carries
    /// the key version so two-key rotation works without an auxiliary
    /// discriminator field.
    pub credential_ciphertext: CredentialCiphertext,

    /// `Some` for OAuth tokens (LinkedIn ~60d, Threads long-lived w/ refresh),
    /// `None` for Bluesky app passwords (which do not expire).
    pub token_expires_at: Option<i64>,

    /// Per-platform auto-post toggle (FR-3 #17). Default `true` on connect.
    pub auto_post_enabled: bool,

    /// Cumulative count of syndicated posts (FR-3 #17).
    pub posts_syndicated_count: i64,

    pub last_synced_at: Option<i64>,

    pub created_at: i64,
    pub updated_at: i64,
}

impl SocialConnection {
    /// Build the `platform_status` value for `(platform, status)` —
    /// `"{platform}#{status}"`. Centralised so connect / disconnect /
    /// dispatcher all produce the same key shape.
    pub fn platform_status_key(platform: SocialPlatform, status: ConnectionStatus) -> String {
        format!("{platform}#{status}")
    }
}

#[cfg(feature = "server")]
impl SocialConnection {
    /// The single connection row for `(user_id, platform)`, if any.
    pub async fn find_by_user_platform(
        user_id: &str,
        platform: SocialPlatform,
    ) -> postgres::Result<Option<Self>> {
        use postgres::ops::{EnumOp, StringOp};
        Self::repository()
            .find_one(
                Self::query()
                    .user_id(StringOp::Eq(user_id.to_string()))
                    .platform(EnumOp::Eq(platform)),
            )
            .await
    }

    /// Every connection row for a user (Connected / AuthExpired / Revoked).
    pub async fn find_by_user(user_id: &str) -> postgres::Result<Vec<Self>> {
        use postgres::ops::StringOp;
        Ok(Self::repository()
            .find(Self::query().user_id(StringOp::Eq(user_id.to_string())))
            .await?
            .items)
    }
}

#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "server", derive(postgres::PostgresEnum))]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default, strum::Display)]
#[serde(rename_all = "snake_case")]
#[strum(serialize_all = "snake_case")]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub enum ConnectionStatus {
    #[default]
    Connected,
    /// Token expired or refresh failed (FR-5 #35). User must reconnect via
    /// the in-app notification CTA.
    AuthExpired,
    /// User-initiated disconnect (FR-1 #7). Soft delete: row is kept with
    /// `credential_ciphertext` zeroed so historical "posted via …"
    /// rendering on past `SyndicationJob` rows still resolves the handle.
    Revoked,
}
