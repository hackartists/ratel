use crate::common::utils::time::get_now_timestamp_millis;
use crate::features::spaces::pages::actions::models::SpaceActionRequiredAttributes;
use crate::features::spaces::pages::apps::apps::sampling::*;
use postgres::PostgresEntity;
use uuid::Uuid;

/// Entry-poll question indices that span the sampling cells, in the order
/// the creator picked them. Stored as a bare jsonb array.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, postgres::PostgresJson)]
#[serde(transparent)]
pub struct SamplingDimensions(pub Vec<usize>);

/// Sampling settings of one space (at most one row per space).
///
/// `population_rules` reuse the Required Attributes rule shape and must all
/// reference `entry_poll_id`. `sampling_started_at` is stamped when the
/// creator moves the space to `Sampling`; from then on the row is frozen.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, PostgresEntity)]
#[postgres(table = "space_sampling_configs", unique(space_id))]
pub struct SpaceSamplingConfig {
    pub id: Uuid,

    /// Bare space id (no `SPACE#` prefix).
    pub space_id: String,
    /// `action_id` of the prerequisite poll whose answers build the population.
    pub entry_poll_id: String,
    pub population_rules: SpaceActionRequiredAttributes,
    pub dimensions: SamplingDimensions,
    pub total_samples: i64,
    pub allocation: SamplingAllocation,
    pub method: SamplingMethod,
    pub allow_recruit_during_sampling: bool,
    pub sampling_started_at: Option<i64>,

    pub created_at: i64,
    pub updated_at: i64,
}

impl SpaceSamplingConfig {
    /// Builds a fresh, unsaved config for `space_id` from the request.
    pub fn new(space_id: &str, req: &UpsertSamplingConfigRequest) -> Self {
        let now = get_now_timestamp_millis();
        Self {
            id: Uuid::now_v7(),
            space_id: space_id.to_string(),
            entry_poll_id: req.entry_poll_id.clone(),
            population_rules: SpaceActionRequiredAttributes(req.population_rules.clone()),
            dimensions: SamplingDimensions(req.dimensions.clone()),
            total_samples: req.total_samples,
            allocation: req.allocation,
            method: req.method,
            allow_recruit_during_sampling: req.allow_recruit_during_sampling,
            sampling_started_at: None,
            created_at: now,
            updated_at: now,
        }
    }

    /// The config of a space, if one was saved.
    pub async fn get_for(space_id: &str) -> crate::common::Result<Option<Self>> {
        use postgres::ops::StringOp;
        Self::repository()
            .find_one(Self::query().space_id(StringOp::Eq(space_id.to_string())))
            .await
            .map_err(crate::common::Error::from)
    }

    /// Removes the config of a space inside `tx`.
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

    pub fn to_dto(&self) -> SamplingConfigDto {
        SamplingConfigDto {
            entry_poll_id: self.entry_poll_id.clone(),
            population_rules: self.population_rules.0.clone(),
            dimensions: self.dimensions.0.clone(),
            total_samples: self.total_samples,
            allocation: self.allocation,
            method: self.method,
            allow_recruit_during_sampling: self.allow_recruit_during_sampling,
            sampling_started_at: self.sampling_started_at,
        }
    }
}

/// Builds `DELETE FROM "<table>" WHERE space_id = $1`; shared by the three
/// Sampling tables, which all key rows by the bare space id.
pub(crate) fn delete_by_space_query(
    table: &str,
    space_id: &str,
) -> postgres::sqlx::QueryBuilder<'static, postgres::sqlx::Postgres> {
    let mut qb = postgres::sqlx::QueryBuilder::<postgres::sqlx::Postgres>::new(format!(
        "DELETE FROM \"{table}\" WHERE space_id = "
    ));
    postgres::Value::from(space_id.to_string()).push_bind(&mut qb);
    qb
}
