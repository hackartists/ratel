use std::collections::HashMap;

use postgres::PostgresEntity;

use crate::common::*;
use crate::features::spaces::pages::actions::actions::poll::SpacePoll;
use crate::features::spaces::pages::actions::models::SpaceAction;
use crate::features::spaces::pages::actions::types::SpaceActionType;
use crate::features::spaces::pages::apps::apps::sampling::services::cells::{
    build_cells, validate_rules,
};
use crate::features::spaces::pages::apps::apps::sampling::services::selection::pick_random;
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
/// prerequisite poll, the population rules still match its questions, and
/// the cells rebuilt from it equal the saved cells. Returns the saved cells.
pub async fn validate_ready(
    space_id: &str,
    config: &SpaceSamplingConfig,
) -> Result<Vec<SpaceSamplingCell>> {
    let poll = load_entry_poll(space_id, &config.entry_poll_id)
        .await?
        .ok_or(SpaceSamplingError::ConfigOutdated)?;
    validate_rules(&poll, &config.entry_poll_id, &config.population_rules.0)
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
/// Stamps `sampling_started_at`. For the random method it draws up to
/// `target` members per cell from the current population, marks them
/// `Selected` and lowers each cell's free seats accordingly. Members who
/// join the population afterwards are counted but never drawn.
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

    let mut by_cell: HashMap<String, Vec<uuid::Uuid>> = HashMap::new();
    for member in SpaceSamplingMember::list_by_space(&config.space_id).await? {
        if member.status == SamplingMemberStatus::Population {
            by_cell.entry(member.cell_key).or_default().push(member.id);
        }
    }

    let draws: Vec<(uuid::Uuid, i64, Vec<uuid::Uuid>)> = {
        let mut rng = rand::rng();
        cells
            .iter()
            .map(|cell| {
                let pool = by_cell.remove(&cell.cell_key).unwrap_or_default();
                let k = usize::try_from(cell.target).unwrap_or(0);
                (cell.id, cell.target, pick_random(pool, k, &mut rng))
            })
            .collect()
    };

    for (cell_id, target, picked) in draws {
        SpaceSamplingMember::mark_selected_tx(tx, &picked, now).await?;
        SpaceSamplingCell::set_remains_tx(tx, cell_id, target - picked.len() as i64).await?;
    }
    Ok(())
}
