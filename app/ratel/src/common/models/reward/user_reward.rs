use crate::common::{types::*, utils::time::get_now_timestamp_millis, *};
use postgres::PostgresEntity;
use postgres::ops::StringOp;
use uuid::Uuid;

/// Per-(target, reward) aggregate counters.
///
/// Was DynamoDB `pk = {target_pk}##REWARD` (a `CompositePartition`) + `sk =
/// {reward_key}`. The constant `##REWARD` suffix is dropped; the natural key
/// is now `(target_pk, reward_key)` (composite UNIQUE) on a surrogate uuid PK.
///
/// `target_pk` is a **cross-feature** actor reference (a `User` or `Team`
/// partition), stored as the full `Partition` string (`"USER#<id>"` /
/// `"TEAM#<id>"`) to preserve the User/Team distinction the DynamoDB prefix
/// gave for free — plain column, no FK (rule 5). `reward_key` is the
/// `RewardKey` Display form (global `REWARD##{behavior}` or space-scoped
/// `SPACE_REWARD##{space}##{action}##{behavior}`); it references config owned
/// by other modules, so it too is a plain string column.
#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq, PostgresEntity)]
#[postgres(table = "user_rewards", unique(target_pk, reward_key))]
pub struct UserReward {
    pub id: Uuid,

    // The composite UNIQUE `(target_pk, reward_key)` covers equality on the
    // `target_pk` leftmost prefix, so `find_by_target` needs no extra index.
    pub target_pk: String,
    pub reward_key: String,

    pub created_at: i64,
    pub updated_at: i64,

    pub total_claims: i64,
    pub total_points: i64,
}

impl UserReward {
    fn available_partition(target_pk: &Partition) -> Result<()> {
        match &target_pk {
            Partition::User(_) | Partition::Team(_) => Ok(()),
            _ => Err(Error::InvalidPartitionKey(
                "Must be User or Team".to_string(),
            )),
        }
    }

    pub fn from_reward(behavior: RewardUserBehavior, target_pk: Partition) -> Result<Self> {
        Self::available_partition(&target_pk)?;
        let reward_key = RewardKey::from(behavior);
        Self::new_zero(target_pk, reward_key)
    }

    pub fn from_reward_key(reward_key: RewardKey, target_pk: Partition) -> Result<Self> {
        Self::available_partition(&target_pk)?;
        Self::new_zero(target_pk, reward_key)
    }

    fn new_zero(target_pk: Partition, reward_key: RewardKey) -> Result<Self> {
        Self::available_partition(&target_pk)?;
        let now = get_now_timestamp_millis();
        Ok(Self {
            id: Uuid::now_v7(),
            target_pk: target_pk.to_string(),
            reward_key: reward_key.to_string(),
            created_at: now,
            updated_at: now,
            total_claims: 0,
            total_points: 0,
        })
    }

    /// Load the single aggregate row for `(target_pk, reward_key)`, or `None`
    /// when the target has never claimed this reward. Was `UserReward::get`
    /// on the `(pk, sk)` pair.
    pub async fn get_for(
        target_pk: &Partition,
        reward_key: &RewardKey,
    ) -> crate::common::Result<Option<Self>> {
        Self::repository()
            .find_one(
                Self::query()
                    .target_pk(StringOp::Eq(target_pk.to_string()))
                    .reward_key(StringOp::Eq(reward_key.to_string())),
            )
            .await
            .map_err(crate::common::Error::from)
    }

    /// Every aggregate row for a target — was the paginated `UserReward::query`
    /// over the `{target_pk}##REWARD` partition (`sum_local_points`). Returns
    /// all rows in one query.
    pub async fn find_by_target(target_pk: &Partition) -> crate::common::Result<Vec<Self>> {
        Ok(Self::repository()
            .find(Self::query().target_pk(StringOp::Eq(target_pk.to_string())))
            .await
            .map_err(crate::common::Error::from)?
            .items)
    }

    /// Insert-or-update on the `(target_pk, reward_key)` natural key. Preserves
    /// the surrogate `id` on conflict.
    pub async fn save(&self) -> crate::common::Result<Self> {
        Self::repository()
            .upsert_on(&["target_pk", "reward_key"], self)
            .await
            .map_err(crate::common::Error::from)
    }
}
