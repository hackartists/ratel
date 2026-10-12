use super::*;

/// Creates the space announcement: a companion `SpaceAction` row only, with
/// its title/body stored in `SpaceAction.title`/`description`. A space holds
/// at most one announcement, so an existing one is returned instead of
/// inserting a second row. Creator only.
#[post("/api/spaces/{space_pk}/announcements", role: SpaceUserRole)]
pub async fn create_space_announcement(space_pk: SpacePartition) -> Result<SpaceAction> {
    if role != SpaceUserRole::Creator {
        return Err(Error::NoPermission);
    }

    let actions = SpaceAction::list_by_space(&space_pk).await?;
    if let Some(existing) = actions
        .into_iter()
        .find(|a| a.space_action_type == SpaceActionType::Announcement)
    {
        return Ok(existing);
    }

    let space_action = SpaceAction::new(
        space_pk,
        uuid::Uuid::now_v7().to_string(),
        SpaceActionType::Announcement,
    );
    SpaceAction::repository()
        .insert(&space_action)
        .await
        .map_err(|e| {
            crate::error!("Failed to create announcement: {e}");
            SpaceActionError::ActionUpdateFailed
        })?;

    Ok(space_action)
}
