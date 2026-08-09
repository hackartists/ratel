use crate::common::{types::*, utils::time::get_now_timestamp_millis, *};
use postgres::PostgresEntity;
use postgres::ops::StringOp;
use uuid::Uuid;

/// Opaque jsonb wrapper for `RewardCondition` — a data-carrying enum
/// (`MaxClaims(i64)`, `MaxUserPoints(i64)`, …). It has no native PG-enum
/// representation and its owning type lives in `common::types` (can't take a
/// postgres derive), so it is stored via serde as jsonb: `None` → `"None"`,
/// `MaxClaims(5)` → `{"MaxClaims":5}`. Round-trips are guaranteed by serde,
/// preserving the exact semantics the DynamoDB attribute carried.
#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq, postgres::PostgresJson)]
pub struct RewardConditionValue(pub RewardCondition);

/// Global (platform-wide) reward configuration.
///
/// Was DynamoDB `pk = REWARD` (a singleton partition) + `sk = {behavior}`,
/// with a `gsi1` on `action` (`find_by_action`). The singleton partition
/// collapses to a plain table keyed by the natural key `behavior` (UNIQUE);
/// `id` is a surrogate uuid PK. `action` keeps a single-column index for the
/// former `find_by_action` query.
///
/// `behavior` / `action` / `period` are the `Display` string forms of their
/// shared `common::types` enums (all unit enums with `Display`/`FromStr`);
/// `condition` is opaque jsonb.
#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq, PostgresEntity)]
#[postgres(table = "rewards")]
pub struct Reward {
    pub id: Uuid,

    /// Natural key — `RewardUserBehavior` Display form. One reward per behavior.
    #[postgres(unique)]
    pub behavior: String,

    /// `RewardAction` Display form. Indexed for the former `find_by_action` GSI.
    #[postgres(index)]
    pub action: String,

    #[postgres(order)]
    pub created_at: i64,
    pub updated_at: i64,

    pub point: i64,
    /// `RewardPeriod` Display form.
    pub period: String,
    pub condition: RewardConditionValue,
}

impl Reward {
    pub fn new(
        user_behavior: RewardUserBehavior,
        point: i64,
        period: RewardPeriod,
        condition: RewardCondition,
    ) -> Self {
        let now = get_now_timestamp_millis();

        Self {
            id: Uuid::now_v7(),
            action: user_behavior.action().to_string(),
            behavior: user_behavior.to_string(),
            created_at: now,
            updated_at: now,
            point,
            period: period.to_string(),
            condition: RewardConditionValue(condition),
        }
    }

    /// Fetch the single global reward for a behavior (was
    /// `Reward::get(Partition::Reward, Some(behavior))`).
    pub async fn get_by_behavior(
        behavior: &RewardUserBehavior,
    ) -> crate::common::Result<Option<Self>> {
        Self::repository()
            .find_one(Self::query().behavior(StringOp::Eq(behavior.to_string())))
            .await
            .map_err(crate::common::Error::from)
    }

    /// All global rewards (was `Reward::query(Partition::Reward, opt_all)`).
    pub async fn list_all() -> crate::common::Result<Vec<Self>> {
        Ok(Self::repository()
            .find(Self::query())
            .await
            .map_err(crate::common::Error::from)?
            .items)
    }

    /// Rewards for a single action (was the `find_by_action` GSI query).
    pub async fn find_by_action(action: &RewardAction) -> crate::common::Result<Vec<Self>> {
        Ok(Self::repository()
            .find(Self::query().action(StringOp::Eq(action.to_string())))
            .await
            .map_err(crate::common::Error::from)?
            .items)
    }

    /// Insert-or-update on the `behavior` natural key.
    pub async fn save(&self) -> crate::common::Result<Self> {
        Self::repository()
            .upsert_on(&["behavior"], self)
            .await
            .map_err(crate::common::Error::from)
    }
}
