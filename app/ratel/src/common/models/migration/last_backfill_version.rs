#[cfg(feature = "server")]
use crate::common::*;
#[cfg(feature = "server")]
use crate::common::utils::time::get_now_timestamp_millis;
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
use uuid::Uuid;

/// Singleton row recording the last successfully applied migration version.
///
/// DynamoDB modeled this as the single `(Partition::Migration,
/// EntityType::LastBackfillVersion)` key. In Postgres the identity collapses to
/// one fixed surrogate id (`singleton_id`) so the entire migration-framework
/// state stays a single row — the whole point of the original (pk, sk).
#[cfg(feature = "server")]
#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq, PostgresEntity)]
#[postgres(table = "last_backfill_versions")]
pub struct LastBackfillVersion {
    pub id: Uuid,

    pub version: i64,
    pub updated_at: i64,
}

#[cfg(feature = "server")]
impl LastBackfillVersion {
    /// The DynamoDB `(pk, sk)` this row used to live at. Retained for callers
    /// (the migration runner / tests) that still reference the key pair; the
    /// `Partition`/`EntityType` variants remain valid.
    pub fn singleton_keys() -> (Partition, EntityType) {
        (Partition::Migration, EntityType::LastBackfillVersion)
    }

    /// Deterministic surrogate id for the one-and-only migration-state row.
    /// Derived from the old `(Migration, LastBackfillVersion)` identity so the
    /// singleton always maps to exactly one Postgres row.
    ///
    /// The `uuid` crate's `v5` feature isn't enabled in this workspace, so the
    /// value is precomputed offline (`uuid::uuid5(NAMESPACE_OID,
    /// "MIGRATION#LAST_BACKFILL_VERSION")`) and pinned as a literal — bit-for-bit
    /// the same deterministic id `Uuid::new_v5` would have produced.
    pub fn singleton_id() -> Uuid {
        Uuid::parse_str("6e17eb5d-cbf6-5686-a9e0-72814669d762")
            .expect("singleton_id literal is a valid UUID")
    }

    /// Read the singleton row, if it has ever been written.
    /// Replaces the old `LastBackfillVersion::get(cli, &pk, Some(&sk))`.
    pub async fn load() -> crate::common::Result<Option<Self>> {
        Self::get_by_id(Self::singleton_id())
            .await
            .map_err(crate::common::Error::from)
    }

    /// Atomically advance the stored version from `expected` to `new_version`.
    ///
    /// Preserves the exact semantics of the former conditional `UpdateItem`:
    /// - On the very first run (`expected == 0`) the row may not exist yet, so
    ///   we permit an insert; if the row already exists it is updated **only**
    ///   when its stored version still equals `expected` (0). This mirrors the
    ///   DynamoDB `attribute_not_exists(version) OR version = :expected`.
    /// - Otherwise (`expected > 0`) the row must already exist with
    ///   `version == expected` — a bare `UPDATE … WHERE version = :expected`
    ///   that never inserts, mirroring the DynamoDB `version = :expected`.
    ///
    /// A conditional failure (`rows_affected == 0`, i.e. another replica already
    /// won the bump / the expected version no longer matches) returns `Err`,
    /// exactly like the DynamoDB `ConditionalCheckFailedException` did.
    pub async fn advance_to(expected: i64, new_version: i64) -> crate::common::Result<()> {
        use postgres::Value;
        use postgres::sqlx::{Postgres, QueryBuilder};

        let now = get_now_timestamp_millis();
        let id = Self::singleton_id();
        let repo = Self::repository();

        let affected = if expected == 0 {
            // First run: insert-if-absent, or update only when the stored
            // version still equals the expected value (0).
            let mut qb = QueryBuilder::<Postgres>::new(
                "INSERT INTO \"last_backfill_versions\" (\"id\", \"version\", \"updated_at\") VALUES (",
            );
            Value::from(id).push_bind(&mut qb);
            qb.push(", ");
            Value::from(new_version).push_bind(&mut qb);
            qb.push(", ");
            Value::from(now).push_bind(&mut qb);
            qb.push(") ON CONFLICT (\"id\") DO UPDATE SET \"version\" = ");
            Value::from(new_version).push_bind(&mut qb);
            qb.push(", \"updated_at\" = ");
            Value::from(now).push_bind(&mut qb);
            qb.push(" WHERE \"last_backfill_versions\".\"version\" = ");
            Value::from(expected).push_bind(&mut qb);

            repo.db()
                .execute(qb)
                .await
                .map_err(crate::common::Error::from)?
        } else {
            // Subsequent runs: the row must already exist with the expected
            // version. Never inserts.
            let mut qb =
                QueryBuilder::<Postgres>::new("UPDATE \"last_backfill_versions\" SET \"version\" = ");
            Value::from(new_version).push_bind(&mut qb);
            qb.push(", \"updated_at\" = ");
            Value::from(now).push_bind(&mut qb);
            qb.push(" WHERE \"id\" = ");
            Value::from(id).push_bind(&mut qb);
            qb.push(" AND \"version\" = ");
            Value::from(expected).push_bind(&mut qb);

            repo.db()
                .execute(qb)
                .await
                .map_err(crate::common::Error::from)?
        };

        if affected == 0 {
            crate::error!(
                "LastBackfillVersion::advance_to conditional check failed (expected={expected}, new={new_version})"
            );
            return Err(crate::common::Error::Internal);
        }

        Ok(())
    }
}
