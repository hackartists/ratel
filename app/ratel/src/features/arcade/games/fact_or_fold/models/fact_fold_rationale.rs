use crate::common::*;

#[allow(unused_imports)]
use rmcp::schemars;

use postgres::PostgresEntity;
use postgres::ops::StringOp;
use uuid::Uuid;

/// One rationale per (round, user). Persisted permanently per §FR-11.
///
/// Postgres migration: surrogate `id` PK + `unique(round_id, user_id)`.
/// `user_pk` keeps the rendered `Partition` form for the essence /
/// DTO layers.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, PostgresEntity)]
#[postgres(table = "fact_fold_rationales", unique(round_id, user_id))]
pub struct FactFoldRationale {
    pub id: Uuid,

    #[postgres(index)]
    pub round_id: String,
    pub user_id: String,

    pub created_at: i64,
    pub updated_at: i64,

    pub user_pk: String,
    pub text: String,
    pub submitted_at: i64,
    /// True iff `text.chars().count() >= RATIONALE_ESSENCE_MIN_CHARS`.
    pub essence_eligible: bool,
    /// Set true once the player opts in via the post-settlement review.
    pub essence_registered: bool,
}

impl FactFoldRationale {
    pub fn new(round_id: &str, user_pk: Partition, text: String, essence_eligible: bool) -> Self {
        let user_id = UserPartition::from(user_pk.clone()).0;
        let now = crate::common::utils::time::get_now_timestamp_millis();
        Self {
            id: Uuid::now_v7(),
            round_id: round_id.to_string(),
            user_id,
            created_at: now,
            updated_at: now,
            user_pk: user_pk.to_string(),
            text,
            submitted_at: now,
            essence_eligible,
            essence_registered: false,
        }
    }

    /// Point read by `(round_id, user_id)`.
    pub async fn get_by_round_user(
        round_id: &str,
        user_id: &str,
    ) -> crate::common::Result<Option<Self>> {
        Self::repository()
            .find_one(
                Self::query()
                    .round_id(StringOp::Eq(round_id.to_string()))
                    .user_id(StringOp::Eq(user_id.to_string())),
            )
            .await
            .map_err(crate::common::Error::from)
    }

    /// Every rationale row for a round.
    pub async fn list_by_round(round_id: &str) -> crate::common::Result<Vec<Self>> {
        Ok(Self::repository()
            .find(Self::query().round_id(StringOp::Eq(round_id.to_string())))
            .await
            .map_err(crate::common::Error::from)?
            .items)
    }

    /// Natural-key upsert on `(round_id, user_id)`.
    pub async fn save(&self) -> crate::common::Result<Self> {
        Self::repository()
            .upsert_on(&["round_id", "user_id"], self)
            .await
            .map_err(crate::common::Error::from)
    }
}
