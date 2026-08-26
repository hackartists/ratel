use crate::common::models::moderation::UserBlock;
use crate::features::spaces::pages::actions::actions::discussion::*;

/// Personal block (App Store UGC req #4): the viewer blocks a user so that
/// user's comments vanish from the viewer's discussion feed instantly. The
/// block is enforced in `list_comments` / `list_replies` via `blocked_author_set`.
#[post("/api/users/{user_id}/block", user: crate::features::auth::User)]
pub async fn block_user(user_id: UserPartition) -> Result<()> {
    let common_config = crate::common::CommonConfig::default();
    let cli = common_config.dynamodb();

    let blocked_pk: Partition = user_id.into();
    if blocked_pk == user.pk {
        return Err(Error::NoPermission);
    }

    let block = UserBlock::new(user.pk.clone(), blocked_pk).ok_or(Error::NoPermission)?;
    block.create(cli).await.map_err(|e| {
        crate::error!("block_user failed: {e}");
        Error::NoPermission
    })?;

    Ok(())
}

/// Undo a personal block.
#[delete("/api/users/{user_id}/block", user: crate::features::auth::User)]
pub async fn unblock_user(user_id: UserPartition) -> Result<()> {
    let common_config = crate::common::CommonConfig::default();
    let cli = common_config.dynamodb();

    let blocked_pk: Partition = user_id.into();
    let (pk, sk) = UserBlock::keys(&user.pk, &blocked_pk).ok_or(Error::NoPermission)?;
    UserBlock::delete(cli, &pk, Some(sk)).await.map_err(|e| {
        crate::error!("unblock_user failed: {e}");
        Error::NoPermission
    })?;

    Ok(())
}
