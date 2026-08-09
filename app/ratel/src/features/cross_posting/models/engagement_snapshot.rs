use crate::common::*;
use crate::features::cross_posting::types::SocialPlatform;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;
use uuid::Uuid;

#[cfg(feature = "server")]
use postgres::PostgresEntity;

/// Per-(post, platform) engagement counts mirror, refreshed by Stage 4 on an
/// adaptive cadence. Author-only on read.
///
/// The next-refresh timestamp does **not** live here — it lives on
/// `SyndicationJob.engagement_next_at` because the scheduler walks jobs.
///
/// Postgres migration: surrogate `id` PK; the DynamoDB `(Feed(post_id),
/// EngagementSnapshot(platform))` identity becomes `unique(post_id,
/// platform)`. `post_id` is a cross-feature reference (posts) — plain String,
/// **no** FK.
///
/// Design doc: docs/superpowers/specs/2026-04-28-cross-posting-design.md
/// (`EngagementSnapshot` section). FR-7 #45.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(PostgresEntity))]
#[cfg_attr(
    feature = "server",
    postgres(table = "engagement_snapshots", unique(post_id, platform))
)]
pub struct EngagementSnapshot {
    pub id: Uuid,

    /// Cross-feature reference to the post (bare feed/post id).
    #[cfg_attr(feature = "server", postgres(index))]
    pub post_id: String,

    pub platform: SocialPlatform,

    pub likes: i32,
    pub comments: i32,
    pub reposts: i32,

    pub fetched_at: i64,
}

#[cfg(feature = "server")]
impl EngagementSnapshot {
    /// The engagement snapshot for `(post_id, platform)`, if any.
    pub async fn find_by_post_platform(
        post_id: &str,
        platform: SocialPlatform,
    ) -> postgres::Result<Option<Self>> {
        use postgres::ops::{EnumOp, StringOp};
        Self::repository()
            .find_one(
                Self::query()
                    .post_id(StringOp::Eq(post_id.to_string()))
                    .platform(EnumOp::Eq(platform)),
            )
            .await
    }
}
