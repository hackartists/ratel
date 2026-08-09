use crate::common::*;

#[allow(unused_imports)]
use rmcp::schemars;

use postgres::PostgresEntity;
use postgres::ops::StringOp;
use uuid::Uuid;

/// Lifetime per-user FOF statistics. Updated as a side effect of
/// settlement.
///
/// Postgres migration: the DynamoDB `(User(user_id),
/// FactFoldUserStats)` pair becomes a surrogate `id` PK plus a
/// `unique(user_id)` natural key.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, PostgresEntity)]
#[postgres(table = "fact_fold_user_stats")]
pub struct FactFoldUserStats {
    pub id: Uuid,

    #[postgres(unique)]
    pub user_id: String,

    pub created_at: i64,
    pub updated_at: i64,

    /// Total rounds the user has played (won or lost).
    pub total_rounds: i64,
    /// Subset of `total_rounds` where the user's final side matched
    /// the truth.
    pub correct_count: i64,
    /// Cumulative chip delta across all rounds.
    pub lifetime_delta_chips: i64,
    /// Millis-since-epoch of the last settled round.
    pub last_played_at: i64,

    /// `Some(round_id)` while the user is bound into an in-flight round.
    pub current_round_id: Option<String>,
}

impl FactFoldUserStats {
    pub async fn get_or_default(user_id: &str) -> crate::common::Result<Self> {
        let row = Self::repository()
            .find_one(Self::query().user_id(StringOp::Eq(user_id.to_string())))
            .await
            .map_err(crate::common::Error::from)?;
        let now = crate::common::utils::time::get_now_timestamp_millis();
        Ok(row.unwrap_or_else(|| Self {
            id: Uuid::now_v7(),
            user_id: user_id.to_string(),
            created_at: now,
            updated_at: now,
            total_rounds: 0,
            correct_count: 0,
            lifetime_delta_chips: 0,
            last_played_at: 0,
            current_round_id: None,
        }))
    }

    /// Natural-key upsert on `user_id`.
    pub async fn save(&self) -> crate::common::Result<Self> {
        Self::repository()
            .upsert_on(&["user_id"], self)
            .await
            .map_err(crate::common::Error::from)
    }
}
