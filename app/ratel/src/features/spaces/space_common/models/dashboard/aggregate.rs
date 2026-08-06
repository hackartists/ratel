use crate::common::Partition;
use serde::{Deserialize, Serialize};
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
use uuid::Uuid;

/// Single aggregate row per space storing all dashboard counters.
///
/// Postgres migration: the DynamoDB identity was `pk = Space(space_id)` +
/// `sk = SpaceDashboardExtension("aggregate")` (one row per space). It becomes
/// a surrogate `id` PK with a plain `space_id` column, unique so the per-space
/// singleton survives. Each counter bump is a single atomic
/// `INSERT … ON CONFLICT (space_id) DO UPDATE SET c = c + $delta` — the
/// Postgres equivalent of the original atomic DynamoDB `ADD` update (no
/// read-modify-write).
///
/// `space_id` is a cross-feature reference (spaces feature) — plain column,
/// **no FK** for now.
#[cfg(feature = "server")]
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, postgres::PostgresEntity)]
#[postgres(table = "space_dashboard_aggregates", unique(space_id))]
pub struct DashboardAggregate {
    pub id: Uuid,

    /// Cross-feature reference to the space (bare id).
    #[postgres(index)]
    pub space_id: String,

    pub poll_count: i64,
    pub post_count: i64,
    pub poll_response_count: i64,
    pub comment_count: i64,
    pub like_count: i64,
    pub total_points: i64,

    #[serde(default)]
    pub meets: i64,
}

#[cfg(feature = "server")]
impl DashboardAggregate {
    fn space_id_of(space_pk: &Partition) -> String {
        match space_pk {
            Partition::Space(id) => id.clone(),
            other => other.to_string(),
        }
    }

    /// The aggregate row for a space, or a zeroed (unsaved, `id == nil`)
    /// instance when the space has no counters yet.
    pub async fn get_or_default(space_pk: &Partition) -> crate::common::Result<Self> {
        use postgres::ops::StringOp;
        let space_id = Self::space_id_of(space_pk);
        match Self::repository()
            .find_one(Self::query().space_id(StringOp::Eq(space_id.clone())))
            .await
            .map_err(|e| {
                crate::error!("dashboard aggregate read failed: {e}");
                crate::features::spaces::types::SpaceError::UpdateFailed
            })? {
            Some(a) => Ok(a),
            None => Ok(Self {
                space_id,
                ..Default::default()
            }),
        }
    }

    /// Ensure a persisted aggregate row exists, returning it. Idempotent: a
    /// concurrent insert (unique(space_id) violation) is resolved by re-reading.
    pub async fn get_or_create(space_pk: &Partition) -> crate::common::Result<Self> {
        use postgres::ops::StringOp;
        let space_id = Self::space_id_of(space_pk);

        if let Some(a) = Self::repository()
            .find_one(Self::query().space_id(StringOp::Eq(space_id.clone())))
            .await
            .map_err(|e| {
                crate::error!("dashboard aggregate read failed: {e}");
                crate::features::spaces::types::SpaceError::UpdateFailed
            })?
        {
            return Ok(a);
        }

        let row = Self {
            id: Uuid::now_v7(),
            space_id: space_id.clone(),
            ..Default::default()
        };
        match Self::repository().insert(&row).await {
            Ok(saved) => Ok(saved),
            // Lost an insert race — the row now exists; re-read it.
            Err(_) => Self::repository()
                .find_one(Self::query().space_id(StringOp::Eq(space_id)))
                .await
                .map_err(|e| {
                    crate::error!("dashboard aggregate read failed: {e}");
                    crate::features::spaces::types::SpaceError::UpdateFailed
                })?
                .ok_or_else(|| crate::features::spaces::types::SpaceError::UpdateFailed.into()),
        }
    }

    /// Atomic single-column increment: `INSERT … ON CONFLICT (space_id) DO
    /// UPDATE SET {column} = table.{column} + $delta`. `column` is a
    /// compile-time-constant identifier (never user input), so the inline
    /// formatting is injection-safe. Other counters fall back to their
    /// `DEFAULT 0` on the insert path.
    async fn bump(space_pk: &Partition, column: &'static str, delta: i64) -> crate::common::Result<()> {
        use postgres::Value;
        use postgres::sqlx::{Postgres, QueryBuilder};

        let space_id = Self::space_id_of(space_pk);
        let table = Self::table_name();

        let mut qb = QueryBuilder::<Postgres>::new(format!(
            "INSERT INTO \"{table}\" (id, space_id, {column}) VALUES ("
        ));
        Value::from(Uuid::now_v7()).push_bind(&mut qb);
        qb.push(", ");
        Value::from(space_id).push_bind(&mut qb);
        qb.push(", ");
        Value::from(delta).push_bind(&mut qb);
        qb.push(format!(
            ") ON CONFLICT (space_id) DO UPDATE SET {column} = \"{table}\".{column} + "
        ));
        Value::from(delta).push_bind(&mut qb);

        Self::repository().db().execute(qb).await.map_err(|e| {
            crate::error!("dashboard aggregate bump({column}) failed: {e}");
            crate::features::spaces::types::SpaceError::UpdateFailed
        })?;
        Ok(())
    }

    pub async fn inc_polls(space_pk: &Partition, delta: i64) -> crate::common::Result<()> {
        Self::bump(space_pk, "poll_count", delta).await
    }

    pub async fn inc_meets(space_pk: &Partition, delta: i64) -> crate::common::Result<()> {
        Self::bump(space_pk, "meets", delta).await
    }

    pub async fn inc_posts(space_pk: &Partition, delta: i64) -> crate::common::Result<()> {
        Self::bump(space_pk, "post_count", delta).await
    }

    pub async fn inc_poll_responses(space_pk: &Partition, delta: i64) -> crate::common::Result<()> {
        Self::bump(space_pk, "poll_response_count", delta).await
    }

    pub async fn inc_comments(space_pk: &Partition, delta: i64) -> crate::common::Result<()> {
        Self::bump(space_pk, "comment_count", delta).await
    }

    pub async fn inc_likes(space_pk: &Partition, delta: i64) -> crate::common::Result<()> {
        Self::bump(space_pk, "like_count", delta).await
    }

    pub async fn inc_points(space_pk: &Partition, delta: i64) -> crate::common::Result<()> {
        Self::bump(space_pk, "total_points", delta).await
    }
}
