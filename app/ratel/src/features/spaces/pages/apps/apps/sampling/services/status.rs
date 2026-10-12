use crate::common::models::space::SpaceCommon;
use crate::common::*;
use crate::features::spaces::pages::actions::actions::poll::SpacePollUserAnswer;
use crate::features::spaces::pages::apps::apps::sampling::services::admission::sampling_space_id;
use crate::features::spaces::pages::apps::apps::sampling::*;

/// Computes what the Sampling entry card shows for `user_pk`.
///
/// Members who entered always see `Entered`. Once the space is ongoing with
/// late joining off, everyone else is closed out; with late joining on the
/// sample no longer restricts anyone. Before that the state follows the
/// member row: none (not answered / not eligible), `Population` (waiting,
/// can enter, cell full or not selected) or `Selected`.
pub async fn my_state(
    space: &SpaceCommon,
    config: Option<&SpaceSamplingConfig>,
    user_pk: &Partition,
) -> Result<(MySamplingState, Option<SpaceSamplingCell>)> {
    let space_id = sampling_space_id(space);
    let member = SpaceSamplingMember::get_for(&space_id, &user_pk.to_string()).await?;
    let cell = match &member {
        Some(m) => SpaceSamplingCell::get_for(&space_id, &m.cell_key).await?,
        None => None,
    };

    if matches!(
        member.as_ref().map(|m| m.status),
        Some(SamplingMemberStatus::Entered)
    ) {
        return Ok((MySamplingState::Entered, cell));
    }

    if matches!(
        space.status,
        Some(SpaceStatus::Ongoing | SpaceStatus::Processing | SpaceStatus::Finished)
    ) {
        let state = if space.join_anytime {
            MySamplingState::ParticipationOpen
        } else {
            MySamplingState::SampleClosed
        };
        return Ok((state, cell));
    }

    let Some(member) = member else {
        let answered = match config {
            Some(cfg) => SpacePollUserAnswer::find_one(
                &space.partition(),
                &EntityType::SpacePoll(cfg.entry_poll_id.clone()),
                user_pk,
            )
            .await?
            .is_some(),
            None => false,
        };
        let state = if answered {
            MySamplingState::NotEligible
        } else if space.is_participation_open() {
            MySamplingState::NotAnswered
        } else {
            MySamplingState::RecruitClosed
        };
        return Ok((state, None));
    };

    let sampling = space.status == Some(SpaceStatus::Sampling);
    let method = config.map(|c| c.method).unwrap_or_default();
    let state = match (member.status, sampling, method) {
        (_, false, _) => MySamplingState::Waiting,
        (SamplingMemberStatus::Selected, true, _) => MySamplingState::Selected,
        (_, true, SamplingMethod::Random) => MySamplingState::NotSelected,
        (_, true, SamplingMethod::FirstCome) => {
            if cell.as_ref().map(|c| c.remains > 0).unwrap_or(false) {
                MySamplingState::CanEnter
            } else {
                MySamplingState::CellFull
            }
        }
    };
    Ok((state, cell))
}
