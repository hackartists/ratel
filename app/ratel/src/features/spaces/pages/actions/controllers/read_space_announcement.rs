use super::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[cfg_attr(
    feature = "ts-bridge",
    derive(ts_rs::TS),
    ts(export, export_to = "types/")
)]
pub struct ReadSpaceAnnouncementResponse {}

/// Records that the caller confirmed the published space announcement, so
/// `list_actions` reports it as participated and the dashboard archives it.
/// Idempotent. Joined participants (Participant/Candidate) and the space
/// Creator only; viewers and anonymous callers are rejected.
#[post("/api/spaces/{space_pk}/announcements/{action_id}/read", role: SpaceUserRole, user: crate::features::auth::User)]
pub async fn read_space_announcement(
    space_pk: SpacePartition,
    action_id: String,
) -> Result<ReadSpaceAnnouncementResponse> {
    if !matches!(
        role,
        SpaceUserRole::Creator | SpaceUserRole::Participant | SpaceUserRole::Candidate
    ) {
        return Err(Error::NoPermission);
    }

    let action = SpaceAction::get_one(&space_pk, &action_id)
        .await?
        .ok_or(Error::SpaceActionNotFound)?;
    let published = matches!(
        action.status,
        Some(SpaceActionStatus::Ongoing | SpaceActionStatus::Finish)
    );
    if action.space_action_type != SpaceActionType::Announcement || !published {
        return Err(Error::SpaceActionNotFound);
    }

    SpaceAnnouncementRead::new(&space_pk, &action_id, &user.pk())
        .save()
        .await
        .map_err(|e| {
            crate::error!("failed to record announcement read: {e}");
            SpaceActionError::ActionUpdateFailed
        })?;

    Ok(ReadSpaceAnnouncementResponse {})
}
