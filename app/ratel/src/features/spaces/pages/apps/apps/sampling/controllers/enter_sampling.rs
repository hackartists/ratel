use crate::common::models::auth::User;
use crate::common::models::space::SpaceCommon;
use crate::features::spaces::pages::apps::apps::sampling::*;

/// Takes a seat in the sample while the space is in `Sampling`.
///
/// First come: claims a free seat of the member's cell atomically and fails
/// with `CellFull` when none is left. Random: only drawn members may enter.
/// Either way the member's unique keys are claimed together with the seat;
/// when another admitted member already holds one of them nothing changes
/// and the call fails with `AlreadyEntered`. Entering twice is a no-op that
/// returns the current state.
#[post("/api/spaces/{space_id}/sampling/enter", space: SpaceCommon, user: User)]
pub async fn enter_sampling(
    space_id: SpacePartition,
) -> crate::common::Result<MySamplingStatusResponse> {
    use crate::common::utils::time::get_now_timestamp_millis;
    use crate::features::spaces::pages::apps::apps::sampling::services::{
        my_state, sampling_space_id,
    };

    let _ = space_id;
    if !space.sampling_enabled {
        return Err(SpaceSamplingError::NotEnabled.into());
    }
    if space.status != Some(SpaceStatus::Sampling) {
        return Err(SpaceSamplingError::NotSampling.into());
    }
    let sid = sampling_space_id(&space);
    let user_pk = user.pk();
    let config = SpaceSamplingConfig::get_for(&sid)
        .await?
        .ok_or(SpaceSamplingError::NotConfigured)?;
    let member = SpaceSamplingMember::get_for(&sid, &user_pk.to_string())
        .await?
        .ok_or(SpaceSamplingError::NotInPopulation)?;

    let now = get_now_timestamp_millis();
    match (member.status, config.method) {
        (SamplingMemberStatus::Entered, _) => {}
        (SamplingMemberStatus::Selected, _) => {
            let tx = postgres::Tx::begin()
                .await
                .map_err(crate::common::Error::from)?;
            if SpaceSamplingMember::mark_entered_tx(
                &tx,
                member.id,
                SamplingMemberStatus::Selected,
                now,
            )
            .await?
                && !SpaceSamplingEntryKey::claim_all_tx(
                    &tx,
                    &sid,
                    member.id,
                    &member.unique_keys.0,
                    now,
                )
                .await?
            {
                tx.rollback().await.map_err(crate::common::Error::from)?;
                return Err(SpaceSamplingError::AlreadyEntered.into());
            }
            tx.commit().await.map_err(crate::common::Error::from)?;
        }
        (SamplingMemberStatus::Population, SamplingMethod::Random) => {
            return Err(SpaceSamplingError::NotSelected.into());
        }
        (SamplingMemberStatus::Population, SamplingMethod::FirstCome) => {
            let tx = postgres::Tx::begin()
                .await
                .map_err(crate::common::Error::from)?;
            if !SpaceSamplingCell::try_claim_tx(&tx, &sid, &member.cell_key).await? {
                tx.rollback().await.map_err(crate::common::Error::from)?;
                return Err(SpaceSamplingError::CellFull.into());
            }
            if !SpaceSamplingMember::mark_entered_tx(
                &tx,
                member.id,
                SamplingMemberStatus::Population,
                now,
            )
            .await?
            {
                tx.rollback().await.map_err(crate::common::Error::from)?;
            } else if SpaceSamplingEntryKey::claim_all_tx(
                &tx,
                &sid,
                member.id,
                &member.unique_keys.0,
                now,
            )
            .await?
            {
                tx.commit().await.map_err(crate::common::Error::from)?;
            } else {
                tx.rollback().await.map_err(crate::common::Error::from)?;
                return Err(SpaceSamplingError::AlreadyEntered.into());
            }
        }
    }

    let (state, cell) = my_state(&space, Some(&config), &user_pk).await?;
    Ok(MySamplingStatusResponse {
        state,
        method: config.method,
        cell_labels: cell.map(|c| c.labels.0).unwrap_or_default(),
    })
}
