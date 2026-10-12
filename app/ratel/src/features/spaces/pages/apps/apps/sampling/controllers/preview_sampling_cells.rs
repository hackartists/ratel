use crate::common::models::space::SpaceCommon;
use crate::features::spaces::pages::apps::apps::sampling::*;

/// Computes the cells and equal-allocation targets for unsaved inputs.
/// Nothing is written. Creator only.
#[post("/api/spaces/{space_id}/sampling/preview", role: SpaceUserRole, space: SpaceCommon)]
pub async fn preview_sampling_cells(
    space_id: SpacePartition,
    req: PreviewSamplingRequest,
) -> crate::common::Result<Vec<SamplingCellDto>> {
    use crate::features::spaces::pages::apps::apps::sampling::services::{
        build_cells, equal_allocation, load_entry_poll, sampling_space_id,
    };

    if role != SpaceUserRole::Creator {
        return Err(Error::NoPermission);
    }
    let _ = space_id;
    if req.total_samples < 1 {
        return Err(SpaceSamplingError::InvalidTotal.into());
    }
    let poll = load_entry_poll(&sampling_space_id(&space), &req.entry_poll_id)
        .await?
        .ok_or(SpaceSamplingError::InvalidEntryPoll)?;
    let specs = build_cells(&poll, &req.dimensions)?;
    let targets = equal_allocation(req.total_samples, specs.len());

    Ok(specs
        .into_iter()
        .zip(targets)
        .map(|(spec, target)| SamplingCellDto {
            position: spec.position,
            cell_key: spec.key,
            labels: spec.labels,
            target,
        })
        .collect())
}
