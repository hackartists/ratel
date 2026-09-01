use crate::common::*;
use crate::features::cross_posting::types::SocialPlatform;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;
use uuid::Uuid;

#[cfg(feature = "server")]
use postgres::PostgresEntity;

/// Number of shards used for sweeper parallelism on the `dispatch_shard` /
/// `engagement_shard` sweeps. **Implementation-fixed; do not change without a
/// re-shard migration** (see Risks → "Re-sharding migration" in the design
/// doc for the dual-read 4 → 32 procedure).
pub const SHARD_COUNT: u32 = 4;

/// Lock TTL for the Stage 2 dispatcher's optimistic lock (seconds). Must
/// exceed the configured max execution time with safety margin. Stealing the
/// lock before TTL elapses risks duplicate external posts; setting it too high
/// slows recovery from a dead worker.
pub const LOCK_TTL_SEC: i64 = 60;

/// One row per (post × platform). Tracks the lifecycle of a single
/// syndication attempt: pending → dispatching (lock held) → published /
/// failed / skipped, with retry scheduling on `dispatch_shard` and engagement
/// polling on `engagement_shard`.
///
/// Postgres migration: surrogate `id` PK; the DynamoDB `(Feed(post_id),
/// SyndicationJob(platform))` identity becomes `unique(post_id, platform)`.
/// `post_id` / `author_user_id` are cross-feature references (posts / auth) —
/// plain String columns, **no** FK.
///
/// Design doc: docs/superpowers/specs/2026-04-28-cross-posting-design.md
/// (`SyndicationJob` section). FR-5 #29–#34, FR-6 #39, FR-7 #45.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(PostgresEntity))]
#[cfg_attr(
    feature = "server",
    postgres(table = "syndication_jobs", unique(post_id, platform))
)]
pub struct SyndicationJob {
    pub id: Uuid,

    /// Cross-feature reference to the post (bare feed/post id). Indexed so the
    /// syndication panel can list all jobs for one post.
    #[cfg_attr(feature = "server", postgres(index))]
    pub post_id: String,

    pub platform: SocialPlatform,

    /// Retry-sweep shard key (Stage 3, 1D). Computed via the shared
    /// `services::shard::shard_for(post_id)` utility. `Some` when the job is
    /// in the retry queue; `None` at terminal states.
    #[cfg_attr(feature = "server", postgres(index))]
    pub dispatch_shard: Option<String>,

    /// Engagement-refresh sweep shard key (Stage 4, 1D). Same shard
    /// derivation as `dispatch_shard`; a separate column lets the two sweeps
    /// scale independently.
    #[cfg_attr(feature = "server", postgres(index))]
    pub engagement_shard: Option<String>,

    /// Retry sweep sort key. Only meaningful when `dispatch_shard.is_some()`.
    pub next_attempt_at: i64,

    /// Engagement sweep sort key. Only meaningful when
    /// `engagement_shard.is_some()`.
    pub engagement_next_at: i64,

    /// Cross-feature reference to the author (bare user id). For fan-out /
    /// privacy re-check at dispatch time.
    pub author_user_id: String,

    pub state: JobState,

    /// 0..=3. Incremented on each terminal-failure write.
    pub attempts: i32,
    pub last_error_category: Option<ErrorCategory>,
    pub last_error_message: Option<String>,

    /// Platform-side identifiers (Published only).
    pub external_post_id: Option<String>,
    pub external_post_url: Option<String>,

    /// Length of the syndicated body (in characters). Body content itself is
    /// **never** persisted on the job — privacy / log-redaction guard
    /// (FR-10 #53). The length is kept for observability only.
    pub body_snapshot_len: i32,

    /// Backlink URL (`{canonical_url}?utm_source={platform}`) baked at
    /// Stage 1 enqueue. Never mutated downstream.
    pub backlink_url: String,

    /// Idempotency lock for in-flight Stage 2 dispatch. Set to a fresh UUID
    /// before the platform API call; cleared after success / failure write.
    pub dispatch_lock_id: Option<String>,
    pub lock_acquired_at: Option<i64>,

    pub created_at: i64,
    pub updated_at: i64,
}

#[cfg(feature = "server")]
impl SyndicationJob {
    /// The single job row for `(post_id, platform)`, if any.
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

    /// Every job row colocated under one post.
    pub async fn find_by_post(post_id: &str) -> postgres::Result<Vec<Self>> {
        use postgres::ops::StringOp;
        Ok(Self::repository()
            .find(Self::query().post_id(StringOp::Eq(post_id.to_string())))
            .await?
            .items)
    }
}

#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "server", derive(postgres::PostgresEnum))]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default, strum::Display)]
#[serde(rename_all = "snake_case")]
#[strum(serialize_all = "snake_case")]
pub enum JobState {
    #[default]
    Pending,
    Published,
    Failed,
    /// Privacy guard tripped at dispatch (post became Private / team-shared
    /// after enqueue). FR-6 #39–#40.
    Skipped,
}

#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "server", derive(postgres::PostgresEnum))]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default, strum::Display)]
#[serde(rename_all = "snake_case")]
#[strum(serialize_all = "snake_case")]
pub enum ErrorCategory {
    #[default]
    Unknown,
    /// Non-retryable. Surface "Reconnect" CTA via inbox notification.
    AuthExpired,
    /// Retryable with backoff.
    RateLimited,
    /// Non-retryable. Platform rejected content (length, policy, etc.).
    ContentRejected,
    /// Retryable with backoff.
    NetworkError,
}
