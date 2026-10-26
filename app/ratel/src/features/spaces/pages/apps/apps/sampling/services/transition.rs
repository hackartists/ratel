use std::collections::HashMap;

use postgres::PostgresEntity;

use crate::common::*;
use crate::features::spaces::pages::actions::actions::poll::SpacePoll;
use crate::features::spaces::pages::actions::models::SpaceAction;
use crate::features::spaces::pages::actions::types::SpaceActionType;
use crate::features::spaces::pages::apps::apps::sampling::services::cells::{
    build_cells, validate_rules,
};
use crate::features::spaces::pages::apps::apps::sampling::services::selection::{
    DrawCandidate, draw_unique,
};
use crate::features::spaces::pages::apps::apps::sampling::services::unique_keys::validate_unique_questions;
use crate::features::spaces::pages::apps::apps::sampling::*;

/// Loads the entry poll of a space after checking that its action is still
/// a prerequisite poll.
pub async fn load_entry_poll(space_id: &str, entry_poll_id: &str) -> Result<Option<SpacePoll>> {
    let space_partition = SpacePartition(space_id.to_string());
    let Some(action) = SpaceAction::get_one(&space_partition, entry_poll_id).await? else {
        return Ok(None);
    };
    if action.space_action_type != SpaceActionType::Poll || !action.prerequisite {
        return Ok(None);
    }
    SpacePoll::get_one(
        &space_partition,
        &SpacePollEntityType(entry_poll_id.to_string()),
    )
    .await
}

/// Confirms a saved config can start sampling: the entry poll is still a
/// prerequisite poll, the population rules and unique questions still match
/// its questions, and the cells rebuilt from it equal the saved cells.
/// Returns the saved cells.
pub async fn validate_ready(
    space_id: &str,
    config: &SpaceSamplingConfig,
) -> Result<Vec<SpaceSamplingCell>> {
    let poll = load_entry_poll(space_id, &config.entry_poll_id)
        .await?
        .ok_or(SpaceSamplingError::ConfigOutdated)?;
    validate_rules(&poll, &config.entry_poll_id, &config.population_rules.0)
        .map_err(|_| SpaceSamplingError::ConfigOutdated)?;
    validate_unique_questions(&poll, &config.unique_questions.0)
        .map_err(|_| SpaceSamplingError::ConfigOutdated)?;
    let specs =
        build_cells(&poll, &config.dimensions.0).map_err(|_| SpaceSamplingError::ConfigOutdated)?;

    let cells = SpaceSamplingCell::list_by_space(space_id).await?;
    let unchanged = specs.len() == cells.len()
        && specs
            .iter()
            .zip(cells.iter())
            .all(|(spec, cell)| spec.key == cell.cell_key && spec.labels == cell.labels.0);
    if !unchanged {
        return Err(SpaceSamplingError::ConfigOutdated.into());
    }
    Ok(cells)
}

/// Starts sampling inside the status-change transaction.
///
/// Stamps `sampling_started_at`. For the random method it draws the sample
/// from the current population in one random order, taking a member while
/// their cell has a seat and none of their unique keys is already drawn,
/// marks them `Selected`, claims their unique keys and lowers each cell's
/// free seats accordingly. Members who join the population afterwards are
/// counted but never drawn.
pub async fn begin_sampling_tx(
    tx: &postgres::Tx,
    config: &SpaceSamplingConfig,
    cells: &[SpaceSamplingCell],
    now: i64,
) -> Result<()> {
    SpaceSamplingConfig::repository()
        .with_tx(tx)
        .update(
            config.id,
            SpaceSamplingConfig::update()
                .sampling_started_at(Some(now))
                .updated_at(now),
        )
        .await
        .map_err(crate::common::Error::from)?;

    if config.method != SamplingMethod::Random {
        return Ok(());
    }

    let candidates: Vec<DrawCandidate> = SpaceSamplingMember::list_by_space(&config.space_id)
        .await?
        .into_iter()
        .filter(|m| m.status == SamplingMemberStatus::Population)
        .map(|m| DrawCandidate {
            id: m.id,
            cell_key: m.cell_key,
            unique_keys: m.unique_keys.0,
        })
        .collect();
    let seats: HashMap<String, usize> = cells
        .iter()
        .map(|c| (c.cell_key.clone(), usize::try_from(c.target).unwrap_or(0)))
        .collect();
    let drawn = {
        let mut rng = rand::rng();
        draw_unique(candidates, &seats, &mut rng)
    };

    let ids: Vec<uuid::Uuid> = drawn.iter().map(|c| c.id).collect();
    SpaceSamplingMember::mark_selected_tx(tx, &ids, now).await?;
    for member in &drawn {
        if !SpaceSamplingEntryKey::claim_all_tx(
            tx,
            &config.space_id,
            member.id,
            &member.unique_keys,
            now,
        )
        .await?
        {
            return Err(SpaceSamplingError::SaveFailed.into());
        }
    }

    let mut picked_per_cell: HashMap<&str, i64> = HashMap::new();
    for member in &drawn {
        *picked_per_cell.entry(member.cell_key.as_str()).or_default() += 1;
    }
    for cell in cells {
        let picked = picked_per_cell
            .get(cell.cell_key.as_str())
            .copied()
            .unwrap_or(0);
        SpaceSamplingCell::set_remains_tx(tx, cell.id, cell.target - picked).await?;
    }
    Ok(())
}
