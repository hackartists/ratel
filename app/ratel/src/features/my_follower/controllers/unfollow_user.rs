#[cfg(feature = "server")]
use crate::common::models::auth::UserFollow;
use crate::features::my_follower::*;

#[delete("/api/my-follower/follow", user: crate::features::auth::User)]
pub async fn unfollow_user(target_pk: Partition) -> Result<()> {
    let user_pk = user.pk();

    if target_pk == user_pk {
        return Err(FollowError::CannotUnfollowSelf.into());
    }

    let Some(follower_row) = UserFollow::find_follower(&target_pk, &user_pk).await? else {
        return Ok(());
    };
    let following_row = UserFollow::find_following(&user_pk, &target_pk).await?;

    let target_uuid = match &target_pk {
        Partition::User(id) | Partition::Team(id) => {
            uuid::Uuid::parse_str(id).map_err(|_| FollowError::InvalidTarget)?
        }
        _ => return Err(FollowError::InvalidTarget.into()),
    };
    let follower_uuid = match &user_pk {
        Partition::User(id) => uuid::Uuid::parse_str(id).map_err(|_| FollowError::InvalidTarget)?,
        _ => return Err(FollowError::InvalidTarget.into()),
    };

    let tx = postgres::Tx::begin().await.map_err(|e| {
        crate::error!("unfollow failed: {e}");
        FollowError::UnfollowFailed
    })?;

    // Idempotent deletes — a row already gone (concurrent unfollow) is not an
    // error, matching DynamoDB's unconditional-delete-in-transaction semantics.
    let _ = UserFollow::repository()
        .with_tx(&tx)
        .delete(follower_row.id)
        .await;
    if let Some(row) = following_row {
        let _ = UserFollow::repository().with_tx(&tx).delete(row.id).await;
    }

    match &target_pk {
        Partition::User(_) => {
            crate::features::my_follower::models::bump_user_counter_tx(
                &tx,
                target_uuid,
                "followers_count",
                -1,
            )
            .await
            .map_err(|e| {
                crate::error!("unfollow failed: {e}");
                FollowError::UnfollowFailed
            })?;
        }
        Partition::Team(_) => {
            crate::features::my_follower::models::bump_team_counter_tx(
                &tx,
                target_uuid,
                "followers",
                -1,
            )
            .await
            .map_err(|e| {
                crate::error!("unfollow failed: {e}");
                FollowError::UnfollowFailed
            })?;
        }
        _ => return Err(FollowError::InvalidTarget.into()),
    };

    crate::features::my_follower::models::bump_user_counter_tx(
        &tx,
        follower_uuid,
        "followings_count",
        -1,
    )
    .await
    .map_err(|e| {
        crate::error!("unfollow failed: {e}");
        FollowError::UnfollowFailed
    })?;

    tx.commit().await.map_err(|e| {
        crate::error!("unfollow commit failed: {e}");
        FollowError::UnfollowFailed
    })?;

    Ok(())
}
