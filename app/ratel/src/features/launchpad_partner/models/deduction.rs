//! Idempotency ledger for Launchpad point deductions. The Biyard console
//! `exchange_points` has no idempotency key, so a retried Launchpad
//! `deduct` would double-spend without this guard.
//!
//! Postgres surrogate-key table. The old DynamoDB identity — `pk =
//! User(company_user_key)`, `sk = LaunchpadDeduction(idempotency_key)` —
//! becomes two first-class columns guarded by a composite UNIQUE
//! `(company_user_key, idempotency_key)`, which is exactly the natural key the
//! old pk/sk encoded. `company_user_key` is a cross-feature reference to the
//! auth `User` (owned by another feature), so it stays a plain `String` column
//! with no FK.

#![cfg(feature = "server")]

use crate::common::utils::time::get_now_timestamp_millis;
use postgres::PostgresEntity;
use postgres::ops::StringOp;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, PostgresEntity)]
#[postgres(table = "launchpad_deductions", unique(company_user_key, idempotency_key))]
pub struct LaunchpadDeduction {
    pub id: Uuid,

    /// Cross-feature reference to the auth `User` (`Partition::User(..)` in the
    /// old model). Plain scalar column — no FK to another feature's table.
    #[postgres(index)]
    pub company_user_key: String,
    /// Launchpad-supplied idempotency key (old `sk` segment).
    pub idempotency_key: String,
    pub point_amount: i64,
    pub brand_tx_id: String,
    pub remaining_points: i64,
    #[postgres(order)]
    pub created_at: i64,
}

impl LaunchpadDeduction {
    pub fn new(
        company_user_key: &str,
        idempotency_key: &str,
        point_amount: i64,
        brand_tx_id: &str,
        remaining_points: i64,
    ) -> Self {
        Self {
            id: Uuid::now_v7(),
            company_user_key: company_user_key.to_string(),
            idempotency_key: idempotency_key.to_string(),
            point_amount,
            brand_tx_id: brand_tx_id.to_string(),
            remaining_points,
            created_at: get_now_timestamp_millis(),
        }
    }

    /// Idempotency lookup by the natural key the old `get(pk, sk)` used.
    /// Returns the stored ledger row for `(company_user_key, idempotency_key)`
    /// if a prior deduction already recorded it.
    pub async fn find_by_keys(
        company_user_key: &str,
        idempotency_key: &str,
    ) -> postgres::Result<Option<Self>> {
        Self::repository()
            .find_one(
                Self::query()
                    .company_user_key(StringOp::Eq(company_user_key.to_string()))
                    .idempotency_key(StringOp::Eq(idempotency_key.to_string())),
            )
            .await
    }
}
