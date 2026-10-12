use crate::features::spaces::pages::apps::apps::sampling::*;
use postgres::PostgresEntity;
use uuid::Uuid;

/// Option texts of a cell, one per sampling question. Stored as a bare jsonb
/// array and compared against the live entry poll before sampling starts.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, postgres::PostgresJson)]
#[serde(transparent)]
pub struct SamplingCellLabels(pub Vec<String>);

/// One sampling cell of a space with its target and free seats.
///
/// `cell_key` joins the chosen option index of every sampling question with
/// `-` (e.g. `"0-1"`); a config without sampling questions has a single cell
/// with an empty key. `remains` is the number of seats still free and only
/// ever decreases through [`SpaceSamplingCell::try_claim_tx`].
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, PostgresEntity)]
#[postgres(table = "space_sampling_cells", unique(space_id, cell_key))]
pub struct SpaceSamplingCell {
    pub id: Uuid,

    #[postgres(index)]
    pub space_id: String,
    pub cell_key: String,
    #[postgres(order)]
    pub position: i64,
    pub labels: SamplingCellLabels,
    pub target: i64,
    pub remains: i64,
}

impl SpaceSamplingCell {
    /// Every cell of a space in cartesian-product order.
    pub async fn list_by_space(space_id: &str) -> crate::common::Result<Vec<Self>> {
        use postgres::ops::StringOp;
        Ok(Self::repository()
            .find(
                Self::query()
                    .space_id(StringOp::Eq(space_id.to_string()))
                    .order_by(SpaceSamplingCellColumn::Position, postgres::Order::Asc),
            )
            .await
            .map_err(crate::common::Error::from)?
            .items)
    }

    /// One cell by its key.
    pub async fn get_for(space_id: &str, cell_key: &str) -> crate::common::Result<Option<Self>> {
        use postgres::ops::StringOp;
        Self::repository()
            .find_one(
                Self::query()
                    .space_id(StringOp::Eq(space_id.to_string()))
                    .cell_key(StringOp::Eq(cell_key.to_string())),
            )
            .await
            .map_err(crate::common::Error::from)
    }

    /// Atomically claims one seat in a cell. Returns `true` only when a seat
    /// was still available, so concurrent first-come entries can never
    /// overfill a cell.
    pub async fn try_claim_tx(
        tx: &postgres::Tx,
        space_id: &str,
        cell_key: &str,
    ) -> crate::common::Result<bool> {
        use postgres::sqlx::{Postgres, QueryBuilder};
        let table = Self::table_name();
        let mut qb = QueryBuilder::<Postgres>::new(format!(
            "UPDATE \"{table}\" SET remains = remains - 1 WHERE space_id = "
        ));
        postgres::Value::from(space_id.to_string()).push_bind(&mut qb);
        qb.push(" AND cell_key = ");
        postgres::Value::from(cell_key.to_string()).push_bind(&mut qb);
        qb.push(" AND remains > 0");
        let affected = Self::repository()
            .with_tx(tx)
            .db()
            .execute(qb)
            .await
            .map_err(crate::common::Error::from)?;
        Ok(affected == 1)
    }

    /// Overwrites the free-seat counter of a cell inside `tx`.
    pub async fn set_remains_tx(
        tx: &postgres::Tx,
        id: Uuid,
        remains: i64,
    ) -> crate::common::Result<()> {
        Self::repository()
            .with_tx(tx)
            .update(id, Self::update().remains(remains))
            .await
            .map_err(crate::common::Error::from)?;
        Ok(())
    }

    /// Removes every cell of a space inside `tx`.
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

    pub fn to_dto(&self) -> SamplingCellDto {
        SamplingCellDto {
            position: self.position,
            cell_key: self.cell_key.clone(),
            labels: self.labels.0.clone(),
            target: self.target,
        }
    }
}
