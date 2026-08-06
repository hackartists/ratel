use super::super::*;
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
use uuid::Uuid;

/// A user's current membership snapshot. Migrated DynamoDB → Postgres.
///
/// Formerly keyed by `pk: Partition` (user) + `sk: EntityType::UserMembership`
/// — one row per user, so `user_pk` is a struct-level `unique`. `membership_pk`
/// / `next_membership` were `MembershipPartition` (owned by the membership
/// feature, Wave 3, un-migrated) → stored as plain `String` columns, no
/// `references=` FK.
#[cfg(feature = "server")]
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, PostgresEntity)]
#[postgres(table = "user_membership_locals", unique(user_pk))]
pub struct UserMembershipLocal {
    pub id: Uuid,
    /// Owning user's `Partition` string. Cross-feature ref → plain column.
    #[postgres(index)]
    pub user_pk: String,
    #[postgres(order)]
    pub created_at: i64,
    pub updated_at: i64,
    pub expired_at: i64,
    /// Membership tier `Partition` string (cross-feature ref).
    pub membership_pk: String,
    pub status: String,
    pub total_credits: i64,
    pub remaining_credits: i64,
    pub auto_renew: bool,
    pub next_membership: Option<String>,
    pub monthly_refill_credits: i64,
    pub next_refill_at: i64,
}
