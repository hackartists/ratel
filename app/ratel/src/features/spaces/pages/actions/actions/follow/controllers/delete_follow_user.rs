use crate::common::models::space::SpaceCommon;
use crate::features::spaces::pages::actions::actions::follow::models::SpaceFollowUser;
use crate::features::spaces::pages::actions::actions::follow::*;
use crate::features::spaces::pages::actions::actions::follow::types::SpaceFollowError;

#[delete("/api/spaces/{space_id}/follows/users", role: SpaceUserRole)]
pub async fn delete_follow_user(space_id: SpacePartition, user_pk: Partition) -> Result<()> {
    SpaceFollowAction::can_edit(&role)?;

    let space_pk: Partition = space_id.clone().into();
    let space = SpaceCommon::get_by_partition(&space_pk)
        .await?
        .ok_or(Error::SpaceNotFound)?;

    use std::str::FromStr;
    let space_user_pk =
        Partition::from_str(&space.user_pk).unwrap_or(Partition::User(space.user_pk.clone()));
    if user_pk == space_user_pk {
        return Err(SpaceFollowError::CreatorCannotBeRemoved.into());
    }

    let existing = SpaceFollowUser::get_one(&space_id, &user_pk).await?;
    let Some(existing) = existing else {
        return Ok(());
    };

    SpaceFollowUser::repository()
        .delete(existing.id)
        .await
        .map_err(crate::common::Error::from)?;
    Ok(())
}
