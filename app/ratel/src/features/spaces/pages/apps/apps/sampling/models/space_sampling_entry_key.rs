use crate::features::spaces::pages::apps::apps::sampling::*;
use postgres::PostgresEntity;
use uuid::Uuid;

/// One unique-answer key claimed by a member admitted to the sample.
///
/// The `(space_id, key_hash)` unique index is what keeps two admitted
/// members of a space from sharing an answer to a unique question: a
/// second claim of the same key waits for the first transaction and fails
/// once it commits.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, PostgresEntity)]
#[postgres(table = "space_sampling_entry_keys", unique(space_id, key_hash))]
pub struct SpaceSamplingEntryKey {
    pub id: Uuid,

    #[postgres(index)]
    pub space_id: String,
    pub key_hash: String,
    #[postgres(index)]
    pub member_id: Uuid,
    pub created_at: i64,
}

impl SpaceSamplingEntryKey {
    /// Claims every key of `member_id` inside `tx`, skipping keys the member
    /// already holds. Returns `false` when another member holds any of them;
    /// the transaction is then unusable and must be rolled back.
    pub async fn claim_all_tx(
        tx: &postgres::Tx,
        space_id: &str,
        member_id: Uuid,
        keys: &[String],
        now: i64,
    ) -> crate::common::Result<bool> {
        use postgres::ops::{StringOp, UuidOp};
        if keys.is_empty() {
            return Ok(true);
        }
        let repo = Self::repository().with_tx(tx);
        let held: Vec<String> = repo
            .find(
                Self::query()
                    .space_id(StringOp::Eq(space_id.to_string()))
                    .member_id(UuidOp::Eq(member_id)),
            )
            .await
            .map_err(crate::common::Error::from)?
            .items
            .into_iter()
            .map(|k| k.key_hash)
            .collect();

        let mut pending: Vec<&String> = keys.iter().filter(|k| !held.contains(k)).collect();
        pending.sort();
        pending.dedup();
        for key_hash in pending {
            let row = Self {
                id: Uuid::now_v7(),
                space_id: space_id.to_string(),
                key_hash: key_hash.clone(),
                member_id,
                created_at: now,
            };
            match repo.insert(&row).await {
                Ok(_) => {}
                Err(e) if is_unique_violation(&e) => return Ok(false),
                Err(e) => return Err(crate::common::Error::from(e)),
            }
        }
        Ok(true)
    }

    /// Every key claimed in a space.
    pub async fn list_by_space(space_id: &str) -> crate::common::Result<Vec<Self>> {
        use postgres::ops::StringOp;
        Ok(Self::repository()
            .find(Self::query().space_id(StringOp::Eq(space_id.to_string())))
            .await
            .map_err(crate::common::Error::from)?
            .items)
    }

    /// Removes every key of a space inside `tx`.
    pub async fn delete_by_space_tx(
        tx: &postgres::Tx,
        space_id: &str,
    ) -> crate::common::Result<()> {
        Self::repository()
            .with_tx(tx)
            .db()
            .execute(delete_by_space_query(&Self::table_name(), space_id))
            .await
            .map_err(crate::common::Error::from)?;
        Ok(())
    }
}

fn is_unique_violation(e: &postgres::Error) -> bool {
    match e {
        postgres::Error::Sqlx(postgres::sqlx::Error::Database(db_err)) => {
            db_err.code().as_deref() == Some("23505")
        }
        _ => false,
    }
}
