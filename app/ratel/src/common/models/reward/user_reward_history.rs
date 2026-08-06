use crate::common::{types::*, utils::time::get_now_timestamp_millis, *};
use postgres::PostgresEntity;
use postgres::ops::StringOp;
use uuid::Uuid;

/// Per-event reward ledger row (one row per credited award).
///
/// Was DynamoDB `pk = {target_pk}##REWARD` (a `CompositePartition`) + `sk =
/// {reward_key}###{time_key}`, with a `gsi1` (`find_reward_by_user`) keyed
/// `pk = URH_BY_TARGET#{target_pk}##REWARD`, `sk = created_at`. The constant
/// `##REWARD` suffix is dropped and the `sk` splits into its two logical
/// parts: `reward_key` + `time_key`. The natural key is `(target_pk,
/// reward_key, time_key)` (composite UNIQUE) on a surrogate uuid PK.
///
/// The old `attribute_not_exists(pk)` conditional-put idempotency (a re-claim
/// in the same period must fail) is now the composite UNIQUE constraint: an
/// `insert` of a duplicate `(target_pk, reward_key, time_key)` fails with a
/// unique violation. Callers that relied on the conditional-put (the owner /
/// actor branches in `SpaceReward::award`) map that failure to
/// `AlreadyClaimedInPeriod`.
///
/// `target_pk` is a **cross-feature** actor reference (`User` or `Team`),
/// stored as the full `Partition` string; indexed for the former GSI query.
/// `reward_key` / `time_key` are the string halves of the old sort key —
/// plain columns, no FK (rule 5).
#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq, PostgresEntity)]
#[postgres(table = "user_reward_histories", unique(target_pk, reward_key, time_key))]
pub struct UserRewardHistory {
    pub id: Uuid,

    /// Actor partition string (`"USER#<id>"` / `"TEAM#<id>"`). Indexed for the
    /// former `find_reward_by_user` GSI (list a target's reward history).
    #[postgres(index)]
    pub target_pk: String,

    /// `RewardKey` Display form.
    pub reward_key: String,

    /// Period bucket (`"ONCE"`, `"20260806"`, `"OWNER#<uid>#<period>"`, …).
    pub time_key: String,

    pub point: i64,

    /// Event time — the former GSI sort key; ordered `Desc` in list queries.
    #[postgres(order)]
    pub created_at: i64,

    pub transaction_id: Option<String>,
    pub month: Option<String>,

    #[serde(default)]
    pub description: Option<String>,

    #[serde(default)]
    pub action_name: Option<String>,
}

impl UserRewardHistory {
    pub fn from_params(
        target_pk: Partition,
        reward_key: RewardKey,
        period: &RewardPeriod,
        amount: i64,
    ) -> Self {
        let now = get_now_timestamp_millis();
        let time_key = period.to_time_key(now);
        Self::from_params_with_time_key(target_pk, reward_key, time_key, amount)
    }

    /// Variant that lets the caller supply an explicit `time_key` instead
    /// of deriving it from a `RewardPeriod`. Used by the owner-bonus
    /// branch in `SpaceReward::award`, where the time-key needs to be
    /// per-actor (`OWNER#{actor_user_id}`) so the team accumulates one
    /// history row per distinct actor — every claim by a new user adds a
    /// row, while a re-claim by the same user is correctly deduped by
    /// the composite UNIQUE `(target_pk, reward_key, time_key)` on `insert`.
    pub fn from_params_with_time_key(
        target_pk: Partition,
        reward_key: RewardKey,
        time_key: crate::common::types::TimeKey,
        amount: i64,
    ) -> Self {
        let now = get_now_timestamp_millis();

        Self {
            id: Uuid::now_v7(),
            target_pk: target_pk.to_string(),
            reward_key: reward_key.to_string(),
            time_key,
            point: amount,
            created_at: now,
            ..Default::default()
        }
    }

    pub fn set_transaction(&mut self, transaction_id: String, month: String) -> &mut Self {
        self.transaction_id = Some(transaction_id);
        self.month = Some(month);
        self
    }

    /// List a target's reward history newest-first (was the
    /// `find_reward_by_user` GSI query, `created_at` descending). One page.
    pub async fn find_by_target(
        target_pk: &Partition,
        page: i64,
        page_size: i64,
    ) -> crate::common::Result<postgres::Page<Self>> {
        Self::repository()
            .find(
                Self::query()
                    .target_pk(StringOp::Eq(target_pk.to_string()))
                    .order_by(UserRewardHistoryColumn::CreatedAt, postgres::Order::Desc)
                    .page(page)
                    .page_size(page_size),
            )
            .await
            .map_err(crate::common::Error::from)
    }
}

/// Resolves `"{space_pk}#{space_title}"` for a UserRewardHistory row.
///
/// The space title lives on the `Post` (every Space is backed by a Post
/// referenced via `SpaceCommon.post_pk`), so this is a two-step lookup.
/// Failures degrade gracefully: a missing space_pk segment in the reward
/// key, a deleted SpaceCommon, or a deleted Post all fall back to
/// `"{space_pk}"` alone so the row still identifies its source space.
/// Used by `SpaceReward::award` at write time.
///
/// `SpaceCommon` (this crate) and `Post` (posts feature) are now Postgres-backed
/// behind the global connection pool, so no DynamoDB client is threaded through.
pub async fn resolve_reward_description(reward_key: &RewardKey) -> String {
    use crate::common::models::space::SpaceCommon;
    use crate::features::posts::models::Post;

    let Some(space_partition) = reward_key.space_pk.clone() else {
        return String::new();
    };

    let space_pk_str = space_partition.to_string();
    let space_pk: Partition = space_partition.into();

    let Ok(Some(common)) = SpaceCommon::get_by_partition(&space_pk).await else {
        return space_pk_str;
    };

    // `common.post_pk` is the originating post's `Partition` string
    // (`"FEED#<uuid>"`); extract the uuid to point-read the Post row.
    let Ok(Partition::Feed(post_uuid_str)) = common.post_pk.parse::<Partition>() else {
        return space_pk_str;
    };
    let Ok(post_uuid) = uuid::Uuid::parse_str(&post_uuid_str) else {
        return space_pk_str;
    };
    let Ok(Some(post)) = Post::get_by_feed_id(post_uuid).await else {
        return space_pk_str;
    };

    if post.title.is_empty() {
        space_pk_str
    } else {
        format!("{}#{}", space_pk_str, post.title)
    }
}

/// Resolves the user-facing behavior label for a UserRewardHistory row
/// (e.g. "투표 응답", "토론 댓글", "퀴즈 답변", "팔로우", "회의 참석").
///
/// Reads `reward_key.behavior` directly — no DB hit. The label set is
/// the one declared via `#[translate(...)]` on `RewardUserBehavior`,
/// rendered in Korean.
pub fn resolve_action_name(reward_key: &RewardKey) -> String {
    use dioxus_translate::{Language, Translate};
    reward_key.behavior.translate(&Language::Ko).to_string()
}
