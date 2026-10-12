use crate::common::models::space::SpaceCommon;
use crate::common::*;
use crate::features::spaces::pages::apps::apps::sampling::*;

/// The bare space id (`SPACE#{id}` without the prefix) used as the key of
/// every Sampling table.
pub fn sampling_space_id(space: &SpaceCommon) -> String {
    match space.partition() {
        Partition::Space(id) => id,
        other => other.to_string(),
    }
}

/// Whether a participant who completed the prerequisites may act once the
/// space is ongoing.
///
/// Spaces without the Sampling app, or with late joining on, admit every
/// such participant. Otherwise only members who entered the sample do.
pub async fn admits_participant(space: &SpaceCommon, user_pk: &Partition) -> Result<bool> {
    if !space.sampling_enabled || space.join_anytime {
        return Ok(true);
    }
    let member =
        SpaceSamplingMember::get_for(&sampling_space_id(space), &user_pk.to_string()).await?;
    Ok(matches!(
        member.map(|m| m.status),
        Some(SamplingMemberStatus::Entered)
    ))
}
