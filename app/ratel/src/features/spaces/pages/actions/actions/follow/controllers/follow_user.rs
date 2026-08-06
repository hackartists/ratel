#[cfg(feature = "server")]
use crate::common::models::auth::UserFollow;
use crate::common::models::space::SpaceCommon;
#[cfg(feature = "server")]
use crate::features::spaces::pages::actions::actions::follow::models::SpaceFollowUser;
use crate::features::spaces::pages::actions::actions::follow::*;
use crate::features::spaces::pages::actions::actions::follow::types::SpaceFollowError;

#[cfg(feature = "server")]
use super::follow_counters::{bump_target_followers_tx, bump_user_followings_tx};

#[mcp_tool(name = "follow_user", description = "Follow a user as part of a space follow action. Requires participant role.")]
#[post(
    "/api/spaces/{space_id}/follows/{follow_id}/user",
    role: SpaceUserRole,
    user: crate::features::auth::User,
    member: crate::common::models::space::SpaceUser,
    space: SpaceCommon
)]
pub async fn follow_user(
    #[mcp(description = "Space partition key")]
    space_id: SpacePartition,
    #[mcp(description = "Follow action sort key (e.g. 'SpaceActionFollow#<uuid>')")]
    follow_id: SpaceActionFollowEntityType,
    #[mcp(description = "Target user partition key to follow (e.g. 'USER#<uuid>')")]
    target_pk: Partition,
) -> Result<()> {
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

    if UserFollow::find_follower(&target_pk, &user.pk())
        .await?
        .is_some()
    {
        return Ok(());
    }

    let (follower_record, following_record) = UserFollow::new_follow_records_with_space(
        user.pk().clone(),
        target_pk.clone(),
        Some(space_id.to_string()),
        Some(follow_id.to_string()),
        Some(member.display_name.clone()),
        Some(member.profile_url.clone()),
    );

    if !matches!(&target_pk, Partition::User(_) | Partition::Team(_)) {
        return Err(SpaceFollowError::InvalidTarget.into());
    }

    let tx = postgres::Tx::begin().await.map_err(|e| {
        crate::error!("Failed to begin tx: {e}");
        SpaceFollowError::FollowFailed
    })?;

    UserFollow::repository()
        .with_tx(&tx)
        .insert(&follower_record)
        .await
        .map_err(|e| {
            crate::error!("Failed to follow user: {e}");
            SpaceFollowError::FollowFailed
        })?;
    UserFollow::repository()
        .with_tx(&tx)
        .insert(&following_record)
        .await
        .map_err(|e| {
            crate::error!("Failed to follow user: {e}");
            SpaceFollowError::FollowFailed
        })?;

    bump_target_followers_tx(&tx, &target_pk, 1)
        .await
        .map_err(|e| {
            crate::error!("Failed to follow user: {e}");
            SpaceFollowError::FollowFailed
        })?;
    bump_user_followings_tx(&tx, &user.pk(), 1)
        .await
        .map_err(|e| {
            crate::error!("Failed to follow user: {e}");
            SpaceFollowError::FollowFailed
        })?;

    tx.commit().await.map_err(|e| {
        crate::error!("Failed to follow user: {e}");
        SpaceFollowError::FollowFailed
    })?;

    // Reward payout + XP recording run on EventBridge via FOLLOWER# INSERT →
    // handle_follow_xp. See features/activity/services/handle_xp_event.rs.

    Ok(())
}
