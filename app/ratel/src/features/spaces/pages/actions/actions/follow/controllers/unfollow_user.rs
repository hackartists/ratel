#[cfg(feature = "server")]
use crate::common::models::auth::UserFollow;
use crate::common::models::space::SpaceCommon;
#[cfg(feature = "server")]
use crate::features::spaces::pages::actions::actions::follow::models::SpaceFollowUser;
use crate::features::spaces::pages::actions::actions::follow::*;
use crate::features::spaces::pages::actions::actions::follow::types::SpaceFollowError;

#[cfg(feature = "server")]
use super::follow_counters::{bump_target_followers_tx, bump_user_followings_tx};

#[delete(
    "/api/spaces/{space_id}/follows/{follow_id}/user",
    role: SpaceUserRole,
    user: crate::features::auth::User,
    space: SpaceCommon
)]
pub async fn unfollow_user(
    space_id: SpacePartition,
    follow_id: SpaceActionFollowEntityType,
    target_pk: Partition,
) -> Result<()> {
    let _ = follow_id;

    if target_pk == user.pk() {
        return Err(SpaceFollowError::CannotFollowSelf.into());
    }

    use std::str::FromStr;
    let space_user_pk =
        Partition::from_str(&space.user_pk).unwrap_or(Partition::User(space.user_pk.clone()));
    let is_allowed_target = if target_pk == space_user_pk {
        true
    } else {
        SpaceFollowUser::get_one(&space_id, &target_pk)
            .await?
            .is_some()
    };

    if !is_allowed_target {
        return Err(SpaceFollowError::InvalidFollowTarget.into());
    }

    if !matches!(&target_pk, Partition::User(_) | Partition::Team(_)) {
        return Err(SpaceFollowError::InvalidTarget.into());
    }

    let Some(follower_row) = UserFollow::find_follower(&target_pk, &user.pk()).await? else {
        return Ok(());
    };
    let following_row = UserFollow::find_following(&user.pk(), &target_pk).await?;

    let tx = postgres::Tx::begin().await.map_err(|e| {
        crate::error!("Failed to begin tx: {e}");
        SpaceFollowError::UnfollowFailed
    })?;

    UserFollow::repository()
        .with_tx(&tx)
        .delete(follower_row.id)
        .await
        .map_err(|e| {
            crate::error!("Failed to unfollow user: {e}");
            SpaceFollowError::UnfollowFailed
        })?;
    if let Some(following_row) = following_row {
        UserFollow::repository()
            .with_tx(&tx)
            .delete(following_row.id)
            .await
            .map_err(|e| {
                crate::error!("Failed to unfollow user: {e}");
                SpaceFollowError::UnfollowFailed
            })?;
    }

    bump_target_followers_tx(&tx, &target_pk, -1)
        .await
        .map_err(|e| {
            crate::error!("Failed to unfollow user: {e}");
            SpaceFollowError::UnfollowFailed
        })?;
    bump_user_followings_tx(&tx, &user.pk(), -1)
        .await
        .map_err(|e| {
            crate::error!("Failed to unfollow user: {e}");
            SpaceFollowError::UnfollowFailed
        })?;

    tx.commit().await.map_err(|e| {
        crate::error!("Failed to unfollow user: {e}");
        SpaceFollowError::UnfollowFailed
    })?;

    Ok(())
}
