use crate::common::*;

#[allow(unused_imports)]
use rmcp::schemars;

use postgres::{Order, PostgresEntity};
use uuid::Uuid;

/// Materialized leaderboard row (PR7), one per user.
///
/// Postgres migration: the DynamoDB accuracy-encoded sort key
/// (`{accuracy_bps:010}#{user_id}` under a shared anchor pk) is
/// replaced by a surrogate `id` PK plus a `unique(user_id)` natural
/// key with `accuracy_bps` as a plain sortable column. The old
/// delete-old-sk-then-write-new-sk dance collapses into a single
/// `upsert_on(user_id)` — the row is updated in place, and a
/// `accuracy_bps DESC` query returns the highest-accuracy users first.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, PostgresEntity)]
#[postgres(table = "fact_fold_leaderboard_entries")]
pub struct FactFoldLeaderboardEntry {
    pub id: Uuid,

    #[postgres(unique)]
    pub user_id: String,

    pub created_at: i64,
    pub updated_at: i64,

    /// Rendered `Partition` string of the user.
    pub user_pk: String,
    /// Accuracy = correct_count / total_rounds, in basis points.
    #[postgres(index)]
    pub accuracy_bps: i32,
    pub total_rounds: i64,
    pub correct_count: i64,
    pub lifetime_delta_chips: i64,
    pub last_played_at: i64,
}

impl FactFoldLeaderboardEntry {
    /// Top entries by accuracy (DESC), then user id (DESC) as a stable
    /// tie-break — matches the old sk-DESC scan ordering.
    pub async fn list_top(limit: i64, offset: i64) -> crate::common::Result<Vec<Self>> {
        Ok(Self::repository()
            .find(
                Self::query()
                    .order_by(FactFoldLeaderboardEntryColumn::AccuracyBps, Order::Desc)
                    .order_by(FactFoldLeaderboardEntryColumn::UserId, Order::Desc)
                    .limit(limit)
                    .offset(offset),
            )
            .await
            .map_err(crate::common::Error::from)?
            .items)
    }

    /// Natural-key upsert on `user_id` (replaces the delete+recreate
    /// pair the sk-encoded accuracy required on DynamoDB).
    pub async fn save(&self) -> crate::common::Result<Self> {
        Self::repository()
            .upsert_on(&["user_id"], self)
            .await
            .map_err(crate::common::Error::from)
    }
}
