use crate::common::models::space::SpaceCommon;
use crate::features::spaces::pages::apps::apps::sampling::*;

/// Saves the Sampling settings of a space and rebuilds its cells and
/// population in one transaction. Creator only, and only while the space
/// is `Designing` or `Open`.
#[put("/api/spaces/{space_id}/sampling", role: SpaceUserRole, space: SpaceCommon)]
pub async fn upsert_sampling_config(
    space_id: SpacePartition,
    req: UpsertSamplingConfigRequest,
) -> crate::common::Result<SamplingSettingsResponse> {
    use std::collections::HashSet;

    use crate::common::utils::time::get_now_timestamp_millis;
    use crate::features::spaces::pages::apps::apps::sampling::services::{
        build_cells, equal_allocation, load_entry_poll, rebuild_population_tx, sampling_space_id,
        validate_rules, validate_unique_questions,
    };
    use postgres::PostgresEntity;

    if role != SpaceUserRole::Creator {
        return Err(Error::NoPermission);
    }
    let _ = space_id;
    if !space.sampling_enabled {
        return Err(SpaceSamplingError::NotEnabled.into());
    }
    if !matches!(
        space.status,
        None | Some(SpaceStatus::Designing | SpaceStatus::Open)
    ) {
        return Err(SpaceSamplingError::ConfigLocked.into());
    }
    if req.total_samples < 1 {
        return Err(SpaceSamplingError::InvalidTotal.into());
    }

    let sid = sampling_space_id(&space);
    let poll = load_entry_poll(&sid, &req.entry_poll_id)
        .await?
        .ok_or(SpaceSamplingError::InvalidEntryPoll)?;
    validate_rules(&poll, &req.entry_poll_id, &req.population_rules)?;
    validate_unique_questions(&poll, &req.unique_questions)?;
    let specs = build_cells(&poll, &req.dimensions)?;
    let targets = equal_allocation(req.total_samples, specs.len());

    let now = get_now_timestamp_millis();
    let mut config = SpaceSamplingConfig::new(&sid, &req);
    if let Some(existing) = SpaceSamplingConfig::get_for(&sid).await? {
        config.id = existing.id;
        config.created_at = existing.created_at;
    }
    config.updated_at = now;

    let cells: Vec<SpaceSamplingCell> = specs
        .into_iter()
        .zip(targets)
        .map(|(spec, target)| SpaceSamplingCell {
            id: uuid::Uuid::now_v7(),
            space_id: sid.clone(),
            cell_key: spec.key,
            position: spec.position,
            labels: SamplingCellLabels(spec.labels),
            target,
            remains: target,
        })
        .collect();
    let cell_keys: HashSet<String> = cells.iter().map(|c| c.cell_key.clone()).collect();

    let save = async {
        let tx = postgres::Tx::begin().await?;
        let saved = SpaceSamplingConfig::repository()
            .with_tx(&tx)
            .upsert_on(&["space_id"], &config)
            .await?;
        SpaceSamplingCell::delete_by_space_tx(&tx, &sid).await?;
        for cell in &cells {
            SpaceSamplingCell::repository()
                .with_tx(&tx)
                .insert(cell)
                .await?;
        }
        rebuild_population_tx(&tx, &space, &saved, &poll, &cell_keys).await?;
        SpaceCommon::repository()
            .with_tx(&tx)
            .update(
                space.id,
                SpaceCommon::update().sampling_recruit_open(saved.allow_recruit_during_sampling),
            )
            .await?;
        tx.commit().await?;
        Ok::<_, crate::common::Error>(saved)
    };
    let saved = save.await.map_err(|e| {
        crate::error!("failed to save sampling config: {e}");
        SpaceSamplingError::SaveFailed
    })?;

    Ok(SamplingSettingsResponse {
        config: Some(saved.to_dto()),
        cells: cells.iter().map(SpaceSamplingCell::to_dto).collect(),
        locked: false,
    })
}
