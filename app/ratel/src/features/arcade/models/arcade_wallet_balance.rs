use crate::common::*;

#[allow(unused_imports)]
use rmcp::schemars;

use postgres::PostgresEntity;
use postgres::ops::StringOp;
use uuid::Uuid;

/// Per-user chip balance singleton.
///
/// Postgres migration: the DynamoDB `(ArcadeWallet(user_id),
/// ArcadeWalletBalance)` pair becomes a surrogate `id` PK plus a
/// `unique(user_id)` natural key — one balance row per user.
/// `user_id` is the bare user id (the inner of `Partition::User`),
/// a cross-feature reference with no FK for now.
///
/// Chip vs RP: see [crate::features::arcade] for the casino metaphor.
/// `chip_balance` is the player's spendable balance — buy-in deducts,
/// settle credits, convert moves RP into chips.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, PostgresEntity)]
#[postgres(table = "arcade_wallet_balances")]
pub struct ArcadeWalletBalance {
    pub id: Uuid,

    /// Bare user id. UNIQUE — one balance per user.
    #[postgres(unique)]
    pub user_id: String,

    pub created_at: i64,
    pub updated_at: i64,

    /// Player's currently spendable chips. v1 RP↔chip is 1:1 but
    /// `chip_balance` is always tracked in chip units.
    pub chip_balance: i64,
}

impl ArcadeWalletBalance {
    /// Load the balance row, returning an empty (zero-balance) row
    /// when the user has never interacted with the arcade. Callers
    /// can `save` it back to materialise the row.
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
            chip_balance: 0,
        }))
    }

    /// Natural-key upsert (insert-or-update on `user_id`).
    pub async fn save(&self) -> crate::common::Result<Self> {
        Self::repository()
            .upsert_on(&["user_id"], self)
            .await
            .map_err(crate::common::Error::from)
    }
}
