use crate::features::spaces::pages::apps::apps::incentive_pool::*;
use uuid::Uuid;

#[cfg(feature = "server")]
use postgres::PostgresEntity;

/// One incentive-pool row per space. Postgres migration: surrogate `id`
/// PK; the DynamoDB `(Space(space_id), SpaceIncentive)` singleton identity
/// becomes the `unique(space_pk)` natural key. `space_pk` is the full
/// `Partition` string (cross-feature reference to the space); no FK.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(PostgresEntity))]
#[cfg_attr(feature = "server", postgres(table = "space_incentives"))]
pub struct SpaceIncentive {
    pub id: Uuid,

    #[cfg_attr(feature = "server", postgres(unique))]
    pub space_pk: String,

    pub created_at: i64,
    pub updated_at: i64,

    #[serde(default)]
    pub contract_address: String,
    #[serde(default)]
    pub deploy_block: i64,
    #[serde(default)]
    pub last_block: i64,
    #[serde(default)]
    pub remaining_count: i64,
    #[serde(default)]
    pub total_count: i64,
}

#[cfg(feature = "server")]
impl SpaceIncentive {
    pub fn new(space_pk: SpacePartition, contract_address: String, deploy_block: i64) -> Self {
        use crate::common::utils::time::get_now_timestamp_millis;

        let now = get_now_timestamp_millis();
        let space_pk: Partition = space_pk.into();

        Self {
            id: Uuid::now_v7(),
            space_pk: space_pk.to_string(),
            created_at: now,
            updated_at: now,
            contract_address,
            deploy_block,
            last_block: 0,
            remaining_count: 0,
            total_count: 0,
        }
    }

    /// The single incentive row for a space, if any.
    pub async fn get_by_space(space_pk: &Partition) -> crate::common::Result<Option<Self>> {
        use postgres::ops::StringOp;
        Ok(Self::repository()
            .find_one(Self::query().space_pk(StringOp::Eq(space_pk.to_string())))
            .await?)
    }

    /// Natural-key upsert on `space_pk` (preserves the surrogate `id`).
    pub async fn save(&self) -> crate::common::Result<Self> {
        Ok(Self::repository().upsert_on(&["space_pk"], self).await?)
    }

    pub fn can_view(_role: SpaceUserRole) -> Result<()> {
        Ok(())
    }

    pub fn can_edit(role: SpaceUserRole) -> Result<()> {
        if role != SpaceUserRole::Creator {
            return Err(Error::NoPermission);
        }
        Ok(())
    }
}
