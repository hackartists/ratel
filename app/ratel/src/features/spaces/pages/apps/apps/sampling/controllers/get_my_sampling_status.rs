use crate::common::models::auth::User;
use crate::common::models::space::SpaceCommon;
use crate::features::spaces::pages::apps::apps::sampling::*;

/// The signed-in user's Sampling state in a space.
#[get("/api/spaces/{space_id}/sampling/me", space: SpaceCommon, user: User)]
pub async fn get_my_sampling_status(
    space_id: SpacePartition,
) -> crate::common::Result<MySamplingStatusResponse> {
    use crate::features::spaces::pages::apps::apps::sampling::services::{
        my_state, sampling_space_id,
    };

    let _ = space_id;
    if !space.sampling_enabled {
        return Err(SpaceSamplingError::NotEnabled.into());
    }
    let config = SpaceSamplingConfig::get_for(&sampling_space_id(&space)).await?;
    let (state, cell) = my_state(&space, config.as_ref(), &user.pk()).await?;

    Ok(MySamplingStatusResponse {
        state,
        method: config.map(|c| c.method).unwrap_or_default(),
        cell_labels: cell.map(|c| c.labels.0).unwrap_or_default(),
    })
}
