use crate::common::*;
use crate::features::cross_posting::types::SocialPlatform;
use std::collections::HashMap;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;
use uuid::Uuid;

#[cfg(feature = "server")]
use postgres::{PostgresEntity, PostgresJson};

/// Opaque JSONB wrapper for the per-post enabled platform set. Stored as one
/// document (never element-queried) so a JSONB column is used instead of a
/// child table — the directive is always read whole by the Stage 1 factory.
#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "server", derive(PostgresJson))]
pub struct EnabledPlatforms(pub Vec<SocialPlatform>);

/// Opaque JSONB wrapper for the per-network compose overrides. Phase 1 always
/// empty; v1.5 fills it. Read whole, so JSONB rather than a child table.
#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "server", derive(PostgresJson))]
pub struct PlatformOverrides(pub HashMap<SocialPlatform, String>);

/// Sidecar entity that carries per-post cross-posting intent **without**
/// polluting the canonical `Post` entity with per-platform fields.
///
/// Written inside the existing `update_post_handler` Publish branch. Read by
/// Stage 1 when `Post.status` transitions Draft → Published.
///
/// Postgres migration: surrogate `id` PK; the DynamoDB `(Feed(post_id),
/// SyndicationDirective)` singleton identity becomes `unique(post_id)`.
/// `post_id` / `author_user_id` are cross-feature references — plain String,
/// **no** FK. The embedded `Vec` / `HashMap` are opaque JSONB columns (read
/// whole, never element-queried).
///
/// Design doc: docs/superpowers/specs/2026-04-28-cross-posting-design.md
/// (`PostSyndicationDirective` section).
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(PostgresEntity))]
#[cfg_attr(
    feature = "server",
    postgres(table = "post_syndication_directives", unique(post_id))
)]
pub struct PostSyndicationDirective {
    pub id: Uuid,

    /// Cross-feature reference to the post (bare feed/post id).
    #[cfg_attr(feature = "server", postgres(index))]
    pub post_id: String,

    pub enabled_platforms: EnabledPlatforms,

    /// Phase 1: always empty (UI does not expose per-network compose
    /// variants). v1.5 fills this; Stage 1 factory pipes the value through
    /// to `SyndicationJob.body_override`.
    pub platform_overrides: PlatformOverrides,

    /// Cross-feature reference to the author (bare user id). Stage 1 reads
    /// this to resolve the matching SocialConnections.
    pub author_user_id: String,

    pub created_at: i64,
}

#[cfg(feature = "server")]
impl PostSyndicationDirective {
    /// The singleton directive row for a post, if any.
    pub async fn find_by_post(post_id: &str) -> postgres::Result<Option<Self>> {
        use postgres::ops::StringOp;
        Self::repository()
            .find_one(Self::query().post_id(StringOp::Eq(post_id.to_string())))
            .await
    }
}
