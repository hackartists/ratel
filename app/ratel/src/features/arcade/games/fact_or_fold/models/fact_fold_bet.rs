use crate::common::*;
use crate::features::arcade::games::fact_or_fold::types::BetSide;

#[allow(unused_imports)]
use rmcp::schemars;

use postgres::PostgresEntity;
use postgres::ops::StringOp;
use uuid::Uuid;

/// One row per (round, user). Settlement reads these rows + the
/// rationales to compute payouts.
///
/// Postgres migration: surrogate `id` PK + `unique(round_id, user_id)`.
/// `user_pk` / `flip_cite_user_pk` keep the rendered `Partition` form.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, PostgresEntity)]
#[postgres(table = "fact_fold_bets", unique(round_id, user_id))]
pub struct FactFoldBet {
    pub id: Uuid,

    #[postgres(index)]
    pub round_id: String,
    pub user_id: String,

    pub created_at: i64,
    pub updated_at: i64,

    pub user_pk: String,
    pub side: BetSide,
    pub amount_rp: i64,
    pub locked_at: i64,
    /// Set by the flip endpoint.
    pub flipped_to: Option<BetSide>,
    /// Rendered `Partition` of the cited player whose rationale drove
    /// the flip.
    pub flip_cite_user_pk: Option<String>,
}

impl FactFoldBet {
    pub fn new(round_id: &str, user_pk: Partition, side: BetSide, amount_rp: i64) -> Self {
        let user_id = UserPartition::from(user_pk.clone()).0;
        let now = crate::common::utils::time::get_now_timestamp_millis();
        Self {
            id: Uuid::now_v7(),
            round_id: round_id.to_string(),
            user_id,
            created_at: now,
            updated_at: now,
            user_pk: user_pk.to_string(),
            side,
            amount_rp,
            locked_at: now,
            flipped_to: None,
            flip_cite_user_pk: None,
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

    /// Every bet row for a round.
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
