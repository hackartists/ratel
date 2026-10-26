use crate::features::spaces::pages::apps::apps::sampling::*;
use postgres::PostgresEntity;
use uuid::Uuid;

/// Hashed unique-answer keys of a member, one per answered unique question.
/// Stored as a bare jsonb array; raw answers are never kept.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, postgres::PostgresJson)]
#[serde(transparent)]
pub struct SamplingUniqueKeys(pub Vec<String>);

/// One population member of a Sampling space.
///
/// A row exists only while the user's entry-poll answers satisfy the
/// population rules. `cell_key` and `unique_keys` are fixed once the member
/// is `Selected` or `Entered`; a `Population` member follows answer edits.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, PostgresEntity)]
#[postgres(table = "space_sampling_members", unique(space_id, user_pk))]
pub struct SpaceSamplingMember {
    pub id: Uuid,

    #[postgres(index)]
    pub space_id: String,
    /// Full user partition (`USER#…`).
    #[postgres(index)]
    pub user_pk: String,
    pub cell_key: String,
    pub status: SamplingMemberStatus,
    #[postgres(order)]
    pub joined_at: i64,
    pub selected_at: Option<i64>,
    pub entered_at: Option<i64>,

    #[postgres(version = 1, sql_default = "'[]'::jsonb")]
    pub unique_keys: SamplingUniqueKeys,
}

impl SpaceSamplingMember {
    /// Builds an unsaved `Population` member.
    pub fn new(
        space_id: &str,
        user_pk: &str,
        cell_key: &str,
        unique_keys: Vec<String>,
        now: i64,
    ) -> Self {
        Self {
            id: Uuid::now_v7(),
            space_id: space_id.to_string(),
            user_pk: user_pk.to_string(),
            cell_key: cell_key.to_string(),
            status: SamplingMemberStatus::Population,
            joined_at: now,
            selected_at: None,
            entered_at: None,
            unique_keys: SamplingUniqueKeys(unique_keys),
        }
    }

    /// The member row of a user, if they are in the population.
    pub async fn get_for(space_id: &str, user_pk: &str) -> crate::common::Result<Option<Self>> {
        use postgres::ops::StringOp;
        Self::repository()
            .find_one(
                Self::query()
                    .space_id(StringOp::Eq(space_id.to_string()))
                    .user_pk(StringOp::Eq(user_pk.to_string())),
            )
            .await
            .map_err(crate::common::Error::from)
    }

    /// Every member of a space, oldest first.
    pub async fn list_by_space(space_id: &str) -> crate::common::Result<Vec<Self>> {
        use postgres::ops::StringOp;
        Ok(Self::repository()
            .find(
                Self::query()
                    .space_id(StringOp::Eq(space_id.to_string()))
                    .order_by(SpaceSamplingMemberColumn::JoinedAt, postgres::Order::Asc),
            )
            .await
            .map_err(crate::common::Error::from)?
            .items)
    }

    /// Natural-key upsert on `(space_id, user_pk)`.
    pub async fn save(&self) -> crate::common::Result<Self> {
        Self::repository()
            .upsert_on(&["space_id", "user_pk"], self)
            .await
            .map_err(crate::common::Error::from)
    }

    /// Inserts a member inside `tx`.
    pub async fn insert_tx(&self, tx: &postgres::Tx) -> crate::common::Result<()> {
        Self::repository()
            .with_tx(tx)
            .insert(self)
            .await
            .map_err(crate::common::Error::from)?;
        Ok(())
    }

    /// Deletes a member row by id (idempotent).
    pub async fn delete(id: Uuid) -> crate::common::Result<()> {
        match Self::repository().delete(id).await {
            Ok(_) | Err(postgres::Error::NotFound) => Ok(()),
            Err(e) => Err(crate::common::Error::from(e)),
        }
    }

    /// Marks the given members `Selected` inside `tx`.
    pub async fn mark_selected_tx(
        tx: &postgres::Tx,
        ids: &[Uuid],
        now: i64,
    ) -> crate::common::Result<()> {
        use postgres::sqlx::{Postgres, QueryBuilder};
        if ids.is_empty() {
            return Ok(());
        }
        let table = Self::table_name();
        let mut qb = QueryBuilder::<Postgres>::new(format!("UPDATE \"{table}\" SET status = "));
        postgres::Value::from(SamplingMemberStatus::Selected).push_bind(&mut qb);
        qb.push(", selected_at = ");
        postgres::Value::from(now).push_bind(&mut qb);
        qb.push(" WHERE id = ANY(");
        qb.push_bind(ids.to_vec());
        qb.push(")");
        Self::repository()
            .with_tx(tx)
            .db()
            .execute(qb)
            .await
            .map_err(crate::common::Error::from)?;
        Ok(())
    }

    /// Moves a member from `from` to `Entered` inside `tx`. Returns `false`
    /// when the member was no longer in `from`, so a concurrent entry by the
    /// same user cannot claim two seats.
    pub async fn mark_entered_tx(
        tx: &postgres::Tx,
        id: Uuid,
        from: SamplingMemberStatus,
        now: i64,
    ) -> crate::common::Result<bool> {
        use postgres::sqlx::{Postgres, QueryBuilder};
        let table = Self::table_name();
        let mut qb = QueryBuilder::<Postgres>::new(format!("UPDATE \"{table}\" SET status = "));
        postgres::Value::from(SamplingMemberStatus::Entered).push_bind(&mut qb);
        qb.push(", entered_at = ");
        postgres::Value::from(now).push_bind(&mut qb);
        qb.push(" WHERE id = ");
        postgres::Value::from(id).push_bind(&mut qb);
        qb.push(" AND status = ");
        postgres::Value::from(from).push_bind(&mut qb);
        let affected = Self::repository()
            .with_tx(tx)
            .db()
            .execute(qb)
            .await
            .map_err(crate::common::Error::from)?;
        Ok(affected == 1)
    }

    /// Removes every member of a space inside `tx`.
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
