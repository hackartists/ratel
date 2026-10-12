use crate::common::models::space::SpaceCommon;
use crate::features::spaces::pages::apps::apps::sampling::*;

/// Per-cell targets and progress of a Sampling space. Creator only.
#[get("/api/spaces/{space_id}/sampling/dashboard", role: SpaceUserRole, space: SpaceCommon)]
pub async fn get_sampling_dashboard(
    space_id: SpacePartition,
) -> crate::common::Result<SamplingDashboardResponse> {
    use std::collections::HashMap;

    use crate::features::spaces::pages::apps::apps::sampling::services::sampling_space_id;

    if role != SpaceUserRole::Creator {
        return Err(Error::NoPermission);
    }
    let _ = space_id;
    let sid = sampling_space_id(&space);
    let config = SpaceSamplingConfig::get_for(&sid)
        .await?
        .ok_or(SpaceSamplingError::NotConfigured)?;
    let cells = SpaceSamplingCell::list_by_space(&sid).await?;

    let mut counts: HashMap<String, (i64, i64, i64)> = HashMap::new();
    for member in SpaceSamplingMember::list_by_space(&sid).await? {
        let entry = counts.entry(member.cell_key).or_default();
        entry.0 += 1;
        match member.status {
            SamplingMemberStatus::Population => {}
            SamplingMemberStatus::Selected => entry.1 += 1,
            SamplingMemberStatus::Entered => {
                entry.1 += 1;
                entry.2 += 1;
            }
        }
    }

    let mut totals = SamplingDashboardTotals::default();
    let rows = cells
        .into_iter()
        .map(|cell| {
            let (population, selected, entered) =
                counts.get(&cell.cell_key).copied().unwrap_or_default();
            totals.target += cell.target;
            totals.population += population;
            totals.selected += selected;
            totals.entered += entered;
            SamplingDashboardRow {
                position: cell.position,
                shortage: population < cell.target,
                filled: entered >= cell.target,
                cell_key: cell.cell_key,
                labels: cell.labels.0,
                target: cell.target,
                population,
                selected,
                entered,
            }
        })
        .collect();

    Ok(SamplingDashboardResponse {
        method: config.method,
        status: space.status,
        rows,
        totals,
    })
}
