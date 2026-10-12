use std::collections::HashSet;

use crate::common::models::space::{SpaceCommon, SpaceParticipant};
use crate::common::utils::time::get_now_timestamp_millis;
use crate::common::*;
use crate::features::spaces::pages::actions::actions::poll::{
    Answer, SpacePoll, SpacePollUserAnswer,
};
use crate::features::spaces::pages::apps::apps::sampling::services::admission::sampling_space_id;
use crate::features::spaces::pages::apps::apps::sampling::services::cells::classify;
use crate::features::spaces::pages::apps::apps::sampling::*;

/// Keeps the population in sync after a user answers the entry poll.
///
/// No-op unless the Sampling app is configured, the answered poll is the
/// entry poll and the space is `Open` or `Sampling`. Members already
/// `Selected` or `Entered` keep their cell. Otherwise the member row is
/// created, moved to the new cell, or removed when the answers no longer
/// satisfy the population rules.
pub async fn on_entry_poll_answered(
    space: &SpaceCommon,
    poll: &SpacePoll,
    user_pk: &Partition,
    answers: &[Answer],
) -> Result<()> {
    if !space.sampling_enabled
        || !matches!(
            space.status,
            Some(SpaceStatus::Open | SpaceStatus::Sampling)
        )
    {
        return Ok(());
    }
    let space_id = sampling_space_id(space);
    let Some(config) = SpaceSamplingConfig::get_for(&space_id).await? else {
        return Ok(());
    };
    if poll.poll_id != config.entry_poll_id {
        return Ok(());
    }

    let user_pk = user_pk.to_string();
    let existing = SpaceSamplingMember::get_for(&space_id, &user_pk).await?;
    if matches!(
        existing.as_ref().map(|m| m.status),
        Some(SamplingMemberStatus::Selected | SamplingMemberStatus::Entered)
    ) {
        return Ok(());
    }

    let cell_key = classify(
        poll,
        &config.population_rules.0,
        &config.dimensions.0,
        answers,
    );
    let cell_key = match cell_key {
        Some(key) if SpaceSamplingCell::get_for(&space_id, &key).await?.is_some() => Some(key),
        _ => None,
    };

    match (cell_key, existing) {
        (None, Some(member)) => SpaceSamplingMember::delete(member.id).await,
        (None, None) => Ok(()),
        (Some(key), Some(mut member)) => {
            member.cell_key = key;
            member.save().await.map(|_| ())
        }
        (Some(key), None) => {
            SpaceSamplingMember::new(&space_id, &user_pk, &key, get_now_timestamp_millis())
                .save()
                .await
                .map(|_| ())
        }
    }
}

/// Rebuilds the whole population of a space inside `tx` from the current
/// entry-poll answers of its participants. Called when the settings are
/// saved, which is only allowed before sampling starts, so every member is
/// still a plain `Population` row.
pub async fn rebuild_population_tx(
    tx: &postgres::Tx,
    space: &SpaceCommon,
    config: &SpaceSamplingConfig,
    poll: &SpacePoll,
    cell_keys: &HashSet<String>,
) -> Result<usize> {
    let space_id = sampling_space_id(space);
    let space_pk = space.partition();
    SpaceSamplingMember::delete_by_space_tx(tx, &space_id).await?;

    let participants: HashSet<String> = SpaceParticipant::find_by_space(&space_pk)
        .await?
        .into_iter()
        .map(|p| p.user_pk)
        .collect();
    let poll_sk = EntityType::SpacePoll(poll.poll_id.clone());
    let answers = SpacePollUserAnswer::list_by_poll(&space_pk, &poll_sk).await?;

    let mut inserted = 0;
    for answer in answers {
        if !participants.contains(&answer.actor_pk) {
            continue;
        }
        let Some(key) = classify(
            poll,
            &config.population_rules.0,
            &config.dimensions.0,
            &answer.answers.0,
        ) else {
            continue;
        };
        if !cell_keys.contains(&key) {
            continue;
        }
        SpaceSamplingMember::new(&space_id, &answer.actor_pk, &key, answer.created_at)
            .insert_tx(tx)
            .await?;
        inserted += 1;
    }
    Ok(inserted)
}
