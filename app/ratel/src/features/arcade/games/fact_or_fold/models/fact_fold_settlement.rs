use crate::common::*;

#[allow(unused_imports)]
use rmcp::schemars;

use postgres::PostgresEntity;
use postgres::ops::StringOp;
use uuid::Uuid;

/// One row per (round, user). `idempotency_key` is the stable
/// composite `{round_id}#{user_id}` — an `insert_new` re-run hits the
/// UNIQUE constraint and fails, so chips never get credited twice
/// (same guarantee the DynamoDB `create` conditional put gave).
///
/// All amounts are in *chips*.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, PostgresEntity)]
#[postgres(table = "fact_fold_settlements")]
pub struct FactFoldSettlement {
    pub id: Uuid,

    #[postgres(index)]
    pub round_id: String,
    pub user_id: String,

    pub created_at: i64,
    pub updated_at: i64,

    /// Rendered `Partition` string of the user.
    pub user_pk: String,

    /// `{round_id}#{user_id}` — the create-if-not-exists dedup key.
    #[postgres(unique)]
    pub idempotency_key: String,

    // ── Breakdown ─────────────────────────────────────────────────
    pub base_refund: i64,
    pub correct_bonus: i64,
    pub pool_share: i64,
    pub influence_bonus: i64,
    pub insider_bonus: i64,

    /// Final chips credited back to the wallet for this user.
    pub chips_out: i64,
}

impl FactFoldSettlement {
    pub fn idempotency_key_for(round_id: &str, user_id: &str) -> String {
        format!("{round_id}#{user_id}")
    }

    /// Every settlement row for a round.
    pub async fn list_by_round(round_id: &str) -> crate::common::Result<Vec<Self>> {
        Ok(Self::repository()
            .find(Self::query().round_id(StringOp::Eq(round_id.to_string())))
            .await
            .map_err(crate::common::Error::from)?
            .items)
    }

    /// Create-if-not-exists on `idempotency_key`. Returns `Err` when a
    /// row already exists (the caller treats that as "already settled").
    pub async fn insert_new(&self) -> crate::common::Result<Self> {
        Self::repository()
            .insert(self)
            .await
            .map_err(crate::common::Error::from)
    }
}
