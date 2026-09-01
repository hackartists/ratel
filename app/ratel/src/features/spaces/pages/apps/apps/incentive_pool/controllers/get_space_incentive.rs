use crate::features::spaces::pages::apps::apps::incentive_pool::models::SpaceIncentive;
use crate::features::spaces::pages::apps::apps::incentive_pool::*;
#[cfg(feature = "server")]
use crate::common::SpaceUserRole;

#[get("/api/spaces/{space_pk}/incentives", role: SpaceUserRole)]
pub async fn get_space_incentive(space_pk: SpacePartition) -> Result<SpaceIncentive> {
    SpaceIncentive::can_view(role)?;

    let space_pk: Partition = space_pk.into();
    let incentive = SpaceIncentive::get_by_space(&space_pk)
        .await?
        .ok_or_else(|| Error::NotFound("Space incentive not found".to_string()))?;

    Ok(incentive)
}
