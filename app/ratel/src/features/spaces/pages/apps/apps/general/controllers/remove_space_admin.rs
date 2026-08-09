use crate::common::models::space::SpaceAdmin;
use crate::features::spaces::pages::apps::apps::general::*;
use crate::features::spaces::pages::apps::types::SpaceAppError;

#[delete("/api/spaces/{space_id}/admins/{user_id}", role: SpaceUserRole)]
pub async fn remove_space_admin(space_id: SpacePartition, user_id: UserPartition) -> Result<()> {
    use crate::common::models::space::SpaceCommon;

    if role != SpaceUserRole::Creator {
        return Err(Error::NoPermission);
    }

    let space_pk: Partition = space_id.into();
    let user_pk: Partition = user_id.into();

    // Prevent removing the space owner
    let space = SpaceCommon::get_by_partition(&space_pk)
        .await?
        .ok_or(Error::SpaceNotFound)?;

    if space.user_pk == user_pk.to_string() {
        return Err(SpaceAppError::CreatorCannotBeRemoved.into());
    }

    SpaceAdmin::get_admin(&space_pk, &user_pk)
        .await?
        .ok_or(Error::NotFound("Space admin not found".to_string()))?;

    SpaceAdmin::delete_admin(&space_pk, &user_pk).await?;

    // Also remove the SpaceParticipant record
    use crate::common::models::space::SpaceParticipant;
    if let Some(participant) = SpaceParticipant::get_participant(&space_pk, &user_pk).await? {
        SpaceParticipant::repository()
            .delete(participant.id)
            .await
            .map_err(crate::common::Error::from)?;

        super::add_space_admin::adjust_space_participants(&space_pk, -1).await?;
    }

    Ok(())
}
