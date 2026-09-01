use crate::common::*;

#[allow(unused_imports)]
use rmcp::schemars;

use postgres::PostgresEntity;
use postgres::ops::StringOp;
use uuid::Uuid;

/// Per-user round state. Distinct from the `Round.participant_pks`
/// list — this row carries privileged info (`is_insider`) and the
/// heartbeat used by the reconnect-grace policy.
///
/// Postgres migration: the DynamoDB `(FactFold(round_id),
/// FactFoldParticipant(user_id))` pair becomes a surrogate `id` PK
/// plus a `unique(round_id, user_id)` natural key. `user_pk` keeps the
/// rendered `Partition` string for the settlement/DTO layers.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, PostgresEntity)]
#[postgres(table = "fact_fold_participants", unique(round_id, user_id))]
pub struct FactFoldParticipant {
    pub id: Uuid,

    #[postgres(index)]
    pub round_id: String,
    /// Bare user id (natural-key component).
    pub user_id: String,

    pub created_at: i64,
    pub updated_at: i64,

    /// Rendered `Partition` string (`"USER#<id>"`).
    pub user_pk: String,
    pub joined_at: i64,
    /// True only on the insider's row.
    pub is_insider: bool,
    pub last_seen_at: i64,
    pub forfeited: bool,
}

impl FactFoldParticipant {
    pub fn new(round_id: &str, user_pk: Partition, is_insider: bool) -> Self {
        let user_id = UserPartition::from(user_pk.clone()).0;
        let now = crate::common::utils::time::get_now_timestamp_millis();
        Self {
            id: Uuid::now_v7(),
            round_id: round_id.to_string(),
            user_id,
            created_at: now,
            updated_at: now,
            user_pk: user_pk.to_string(),
            joined_at: now,
            is_insider,
            last_seen_at: now,
            forfeited: false,
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

    /// Every participant row for a round.
    pub async fn list_by_round(round_id: &str) -> crate::common::Result<Vec<Self>> {
        Ok(Self::repository()
            .find(Self::query().round_id(StringOp::Eq(round_id.to_string())))
            .await
            .map_err(crate::common::Error::from)?
            .items)
    }

    /// Create-if-not-exists on `(round_id, user_id)`.
    pub async fn insert_new(&self) -> crate::common::Result<Self> {
        Self::repository()
            .insert(self)
            .await
            .map_err(crate::common::Error::from)
    }

    /// Natural-key upsert on `(round_id, user_id)`.
    pub async fn save(&self) -> crate::common::Result<Self> {
        Self::repository()
            .upsert_on(&["round_id", "user_id"], self)
            .await
            .map_err(crate::common::Error::from)
    }
}
