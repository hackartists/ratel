use crate::common::*;

#[allow(unused_imports)]
use rmcp::schemars;

use postgres::{PostgresEntity, PostgresEnum};
use uuid::Uuid;

/// Wallet transaction kind. Together with `amount` (signed) this is
/// the full record of what happened. `ref_*` fields are optional
/// breadcrumbs back to the entity that caused the txn.
#[derive(
    Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, PostgresEnum,
)]
pub enum ArcadeTxnKind {
    /// RP → chip conversion. `amount` is positive (chips credited).
    #[default]
    Convert,
    /// Chip → RP redemption. `amount` is negative (chips debited).
    /// v1 endpoint is disabled but the kind exists for forward compat.
    Redeem,
    /// Round buy-in. `amount` is negative (chips placed on the table).
    BuyIn,
    /// Round settle. `amount` is positive when the player wins chips
    /// back, zero when they lose everything.
    Settle,
    /// Operator-driven grant or correction.
    Adjustment,
}

/// Append-only ledger row for the arcade wallet. Each chip movement
/// (convert / buy-in / settle / ...) writes one row.
///
/// Postgres migration: the DynamoDB `(ArcadeWallet(user_id),
/// ArcadeWalletTxn(txn_id))` pair becomes a surrogate `id` PK; the
/// globally-unique `txn_id` (uuid_v7) is the natural key. `user_id`
/// is the bare user id, indexed for per-user history sweeps.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, PostgresEntity)]
#[postgres(table = "arcade_wallet_transactions")]
pub struct ArcadeWalletTransaction {
    pub id: Uuid,

    /// Bare user id. Indexed for per-user ledger scans.
    #[postgres(index)]
    pub user_id: String,

    /// Globally-unique txn id (uuid_v7, time-sortable). UNIQUE.
    #[postgres(unique)]
    pub txn_id: String,

    #[postgres(order)]
    pub created_at: i64,
    pub updated_at: i64,

    pub kind: ArcadeTxnKind,

    /// Signed chip delta. Positive = credited, negative = debited.
    pub amount: i64,

    /// Player chip balance *after* this txn was applied.
    pub balance_after: i64,

    /// For BuyIn / Settle: the round this txn relates to. Stored as
    /// the raw round id (no prefix).
    #[serde(default)]
    pub ref_round_id: Option<String>,
}

impl ArcadeWalletTransaction {
    /// Insert a fresh ledger row. `txn_id` is globally unique so this
    /// is always a new row.
    pub async fn insert_row(&self) -> crate::common::Result<Self> {
        Self::repository()
            .insert(self)
            .await
            .map_err(crate::common::Error::from)
    }
}
