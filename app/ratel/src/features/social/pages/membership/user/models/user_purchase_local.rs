use super::super::*;
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
use uuid::Uuid;

/// Purchase / payment history row for a user. Migrated DynamoDB → Postgres.
///
/// The former DynamoDB shape used a composite partition key
/// `CompositePartition(user_pk, Purchase)` plus an `EntityType` sort key and
/// three GSIs (`find_by_user`, `find_by_status`, `find_by_payment_id`). In
/// Postgres this collapses to a surrogate `id` with plain indexed columns:
/// `user_pk` (the owning user's `Partition` string — a cross-feature ref, so
/// no `references=` FK yet), `status`, and `payment_id`.
///
/// `tx_type` was a payload-carrying `TransactionType` enum serialized via
/// `Display`/`FromStr`. Because it is not expressible as a native
/// `PostgresEnum` (it carries a `MembershipTier` payload), it is flattened to
/// its `String` display form here (reversible via `TransactionType::from_str`).
#[cfg(feature = "server")]
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, PostgresEntity)]
#[postgres(table = "user_purchases")]
pub struct UserPurchaseLocal {
    pub id: Uuid,
    /// Owning user's `Partition` string (e.g. `USER#abc`). Cross-feature ref
    /// (User = Wave 9, un-migrated) → plain indexed column, no `references=`.
    #[postgres(index)]
    pub user_pk: String,
    #[postgres(order)]
    pub created_at: i64,
    #[postgres(index)]
    pub status: String,
    /// `TransactionType` flattened to its `Display` string.
    pub tx_type: String,
    pub amount: i64,
    pub currency: String,
    #[postgres(index)]
    pub payment_id: String,
    pub tx_id: String,
}
