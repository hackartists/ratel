use crate::common::models::space::SpaceCommon;
use crate::features::spaces::pages::apps::apps::sampling::*;

/// Saved Sampling settings and cells of a space. Creator only.
#[get("/api/spaces/{space_id}/sampling", role: SpaceUserRole, space: SpaceCommon)]
pub async fn get_sampling_settings(
    space_id: SpacePartition,
) -> crate::common::Result<SamplingSettingsResponse> {
    use crate::features::spaces::pages::apps::apps::sampling::services::sampling_space_id;

    if role != SpaceUserRole::Creator {
        return Err(Error::NoPermission);
    }
    let _ = space_id;
    let sid = sampling_space_id(&space);
    let config = SpaceSamplingConfig::get_for(&sid).await?;
    let cells = SpaceSamplingCell::list_by_space(&sid).await?;

    Ok(SamplingSettingsResponse {
        config: config.as_ref().map(SpaceSamplingConfig::to_dto),
        cells: cells.iter().map(SpaceSamplingCell::to_dto).collect(),
        locked: !matches!(
            space.status,
            None | Some(SpaceStatus::Designing | SpaceStatus::Open)
        ),
    })
}
