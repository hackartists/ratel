use crate::features::timeline::*;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

/// Reason why a post appeared in someone's timeline.
///
/// Stored natively as a Postgres enum (`following` / `team_member` / `popular`
/// / `popular_space`). The label set matches the manual [`Display`] impl so the
/// string form used by the API (`category` query param, `TimelineCategoryRow`)
/// and the DB label are identical.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "server", derive(postgres::PostgresEnum))]
pub enum TimelineReason {
    /// Author posted it and you follow them
    #[default]
    Following,
    /// You are a member of the team that posted it
    TeamMember,
    /// Post is trending (met popularity criteria)
    Popular,
    /// Space associated with the post is popular (>5 participants)
    PopularSpace,
}

impl std::fmt::Display for TimelineReason {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TimelineReason::Following => write!(f, "following"),
            TimelineReason::TeamMember => write!(f, "team_member"),
            TimelineReason::Popular => write!(f, "popular"),
            TimelineReason::PopularSpace => write!(f, "popular_space"),
        }
    }
}

impl std::str::FromStr for TimelineReason {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        match s {
            "following" => Ok(TimelineReason::Following),
            "team_member" => Ok(TimelineReason::TeamMember),
            "popular" => Ok(TimelineReason::Popular),
            "popular_space" => Ok(TimelineReason::PopularSpace),
            _ => Err(format!("unknown timeline reason: {}", s)),
        }
    }
}

/// All available timeline categories.
pub const TIMELINE_CATEGORIES: &[TimelineReason] = &[
    TimelineReason::Following,
    TimelineReason::TeamMember,
    TimelineReason::Popular,
    TimelineReason::PopularSpace,
];

/// One row in a user's timeline: "post P appeared in user U's feed at time T
/// for reason R".
///
/// # Identity
///
/// The DynamoDB entity keyed this by `pk = TIMELINE#{user_id}` +
/// `sk = TIMELINE_ENTRY#{created_at}#{post_id}`, so the natural identity is
/// `(user_id, created_at, post_id)` — `reason` was **not** part of the key, so
/// a re-delivery of the same post to the same user overwrote the row and
/// changed its `reason`/category. That behaviour is preserved here by the
/// `unique(user_id, created_at, post_id)` constraint together with
/// `upsert_on(&["user_id", "created_at", "post_id"], …)` on write.
///
/// # Cross-feature references
///
/// `post_id` (a `posts` FEED id) and `author_id` (a `users`/`teams` id) are
/// entities owned by other features, so they are plain columns with no FK for
/// now. `user_id` is the timeline owner; the old category GSI (`TL_CAT#{user_id}#{reason}`)
/// becomes a `(user_id, reason)` filtered query against the `user_id` index.
#[cfg(feature = "server")]
#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq, postgres::PostgresEntity)]
#[postgres(table = "timeline_entries", unique(user_id, created_at, post_id))]
pub struct TimelineEntry {
    pub id: uuid::Uuid,

    /// Timeline owner id — the inner id of `USER#{id}` or `TEAM#{id}`. The old
    /// category GSI partitioned on `{user_id}#{reason}`; queries now filter on
    /// this indexed column plus `reason`.
    #[postgres(index)]
    pub user_id: String,

    #[postgres(order)]
    pub created_at: i64,

    /// FEED id of the referenced post (owned by the `posts` feature).
    pub post_id: String,

    /// Author id — inner id of `USER#{id}` or `TEAM#{id}` (owned by `users`/`teams`).
    pub author_id: String,

    /// True when the author was a team (`TEAM#…`), false for a user.
    pub author_is_team: bool,

    pub reason: TimelineReason,
}

/// Client-side stub so non-server builds still resolve the type referenced by
/// (server-only) controllers/services. Carries no ORM derive.
#[cfg(not(feature = "server"))]
#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq)]
pub struct TimelineEntry {
    pub id: uuid::Uuid,
    pub user_id: String,
    pub created_at: i64,
    pub post_id: String,
    pub author_id: String,
    pub author_is_team: bool,
    pub reason: TimelineReason,
}

#[cfg(feature = "server")]
impl TimelineEntry {
    /// Build a new entry. Signature is kept identical to the DynamoDB version
    /// (all `Partition` args) so the fan-out services barely change: the
    /// prefixes are stripped into plain id columns here.
    pub fn new(
        user_pk: &Partition,
        post_pk: &Partition,
        author_pk: &Partition,
        created_at: i64,
        reason: TimelineReason,
    ) -> Self {
        let user_id = match user_pk {
            Partition::User(id) => id.clone(),
            Partition::Team(id) => id.clone(),
            _ => user_pk.to_string(),
        };

        let post_id = match post_pk {
            Partition::Feed(id) => id.clone(),
            _ => post_pk.to_string(),
        };

        let (author_id, author_is_team) = match author_pk {
            Partition::Team(id) => (id.clone(), true),
            Partition::User(id) => (id.clone(), false),
            _ => (author_pk.to_string(), false),
        };

        Self {
            id: uuid::Uuid::new_v7(uuid::Timestamp::now(uuid::NoContext)),
            user_id,
            created_at,
            post_id,
            author_id,
            author_is_team,
            reason,
        }
    }
}
