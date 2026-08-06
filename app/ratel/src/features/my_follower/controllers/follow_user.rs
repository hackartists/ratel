use crate::common::models::auth::UserFollow;
use crate::features::my_follower::*;

#[post("/api/my-follower/follow", user: crate::features::auth::User)]
pub async fn follow_user(target_pk: Partition) -> Result<()> {
    let user_pk = user.pk();

    if target_pk == user_pk {
        return Err(crate::features::my_follower::types::FollowError::CannotFollowSelf.into());
    }

    if UserFollow::find_follower(&target_pk, &user_pk)
        .await?
        .is_some()
    {
        return Ok(());
    }

    let (follower_record, following_record) =
        UserFollow::new_follow_records(user_pk.clone(), target_pk.clone());

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
        crate::error!("follow failed: {e}");
        FollowError::FollowFailed
    })?;

    UserFollow::repository()
        .with_tx(&tx)
        .insert(&follower_record)
        .await
        .map_err(|e| {
            crate::error!("follow failed: {e}");
            FollowError::FollowFailed
        })?;
    UserFollow::repository()
        .with_tx(&tx)
        .insert(&following_record)
        .await
        .map_err(|e| {
            crate::error!("follow failed: {e}");
            FollowError::FollowFailed
        })?;

    match &target_pk {
        Partition::User(_) => {
            crate::features::my_follower::models::bump_user_counter_tx(
                &tx,
                target_uuid,
                "followers_count",
                1,
            )
            .await
            .map_err(|e| {
                crate::error!("follow failed: {e}");
                FollowError::FollowFailed
            })?;
        }
        Partition::Team(_) => {
            crate::features::my_follower::models::bump_team_counter_tx(
                &tx,
                target_uuid,
                "followers",
                1,
            )
            .await
            .map_err(|e| {
                crate::error!("follow failed: {e}");
                FollowError::FollowFailed
            })?;
        }
        _ => return Err(FollowError::InvalidTarget.into()),
    };

    crate::features::my_follower::models::bump_user_counter_tx(
        &tx,
        follower_uuid,
        "followings_count",
        1,
    )
    .await
    .map_err(|e| {
        crate::error!("follow failed: {e}");
        FollowError::FollowFailed
    })?;

    tx.commit().await.map_err(|e| {
        crate::error!("follow commit failed: {e}");
        FollowError::FollowFailed
    })?;

    Ok(())
}
