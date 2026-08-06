use crate::common::*;
use crate::features::arcade::games::fact_or_fold::types::RoundStatus;

#[allow(unused_imports)]
use rmcp::schemars;

use postgres::ops::StringOp;
use postgres::{PostgresEntity, PostgresJson};
use uuid::Uuid;

/// jsonb newtype for the denormalized participant list. Stores the
/// rendered `Partition` strings (`"USER#<id>"`). serde treats the
/// single-field tuple newtype transparently → bare JSON array.
/// `Deref`/`DerefMut` expose the inner `Vec<String>`.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, PostgresJson)]
pub struct PartitionList(pub Vec<String>);

impl std::ops::Deref for PartitionList {
    type Target = Vec<String>;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}
impl std::ops::DerefMut for PartitionList {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}

/// One round = one subject being judged by ≤ `round_capacity` players.
///
/// Postgres migration: the DynamoDB `(FactFold(round_id),
/// FactFoldRound(round_id))` pair becomes a surrogate `id` PK plus a
/// `unique(round_id)` natural key. `participant_pks` (was
/// `Vec<Partition>`) is a jsonb array of rendered `Partition` strings.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, PostgresEntity)]
#[postgres(table = "fact_fold_rounds")]
pub struct FactFoldRound {
    pub id: Uuid,

    /// Business round id. UNIQUE.
    #[postgres(unique)]
    pub round_id: String,

    pub created_at: i64,
    pub updated_at: i64,

    /// Subject being judged (bare subject id).
    pub subject_id: String,

    pub status: RoundStatus,

    /// User pks in join order (rendered `Partition` strings).
    pub participant_pks: PartitionList,

    /// Set when the round leaves Waiting.
    pub started_at: Option<i64>,
    /// Set when the round reaches Settled.
    pub settled_at: Option<i64>,

    /// Millis-since-epoch when the *current* stage began.
    pub stage_started_at: Option<i64>,
    /// Millis-since-epoch when the current stage is scheduled to
    /// auto-advance.
    pub stage_deadline_at: Option<i64>,
}

impl FactFoldRound {
    pub fn new_waiting(round_id: String, subject_id: String, first_user_pk: Partition) -> Self {
        let now = crate::common::utils::time::get_now_timestamp_millis();
        Self {
            id: Uuid::now_v7(),
            round_id,
            created_at: now,
            updated_at: now,
            subject_id,
            status: RoundStatus::Waiting,
            participant_pks: PartitionList(vec![first_user_pk.to_string()]),
            started_at: None,
            settled_at: None,
            stage_started_at: None,
            stage_deadline_at: None,
        }
    }

    /// Point read by business round id.
    pub async fn get_by_round_id(round_id: &str) -> crate::common::Result<Option<Self>> {
        Self::repository()
            .find_one(Self::query().round_id(StringOp::Eq(round_id.to_string())))
            .await
            .map_err(crate::common::Error::from)
    }

    /// Create-if-not-exists on `round_id`.
    pub async fn insert_new(&self) -> crate::common::Result<Self> {
        Self::repository()
            .insert(self)
            .await
            .map_err(crate::common::Error::from)
    }

    /// Natural-key upsert on `round_id` (full-row overwrite).
    pub async fn save(&self) -> crate::common::Result<Self> {
        Self::repository()
            .upsert_on(&["round_id"], self)
            .await
            .map_err(crate::common::Error::from)
    }
}
