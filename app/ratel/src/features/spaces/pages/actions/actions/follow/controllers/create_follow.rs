use crate::common::models::space::SpaceCommon;
use crate::features::spaces::pages::actions::actions::follow::models::*;
use crate::features::spaces::pages::actions::actions::follow::types::SpaceFollowError;
use crate::features::spaces::pages::actions::actions::follow::*;

#[mcp_tool(
    name = "create_follow",
    description = "Create a follow action in a space. Requires creator role."
)]
#[post(
    "/api/spaces/{space_pk}/follows",
    role: SpaceUserRole,
    user: crate::features::auth::User,
    space: SpaceCommon
)]
pub async fn create_follow(
    #[mcp(description = "Space partition key")] space_pk: SpacePartition,
) -> Result<SpaceFollowAction> {
    SpaceFollowAction::can_edit(&role)?;

    // The follow action is a singleton per space — return the existing one if present.
    if let Some(existing) = SpaceFollowAction::find_for_space(&space_pk).await? {
        return Ok(existing);
    }

    let follow = SpaceFollowAction::new(space_pk.clone());
    let mut space_action = crate::features::spaces::pages::actions::models::SpaceAction::new(
        space_pk.clone(),
        follow.follow_id.clone(),
        crate::features::spaces::pages::actions::types::SpaceActionType::Follow,
    );
    space_action.title = if space.author_display_name.is_empty() {
        space.author_username
    } else {
        space.author_display_name
    };

    let tx = postgres::Tx::begin().await.map_err(|e| {
        crate::error!("Failed to begin tx: {e}");
        SpaceFollowError::CreateFailed
    })?;
    SpaceFollowAction::repository()
        .with_tx(&tx)
        .insert(&follow)
        .await
        .map_err(|e| {
            crate::error!("Failed to create follow: {e}");
            SpaceFollowError::CreateFailed
        })?;
    crate::features::spaces::pages::actions::models::SpaceAction::repository()
        .with_tx(&tx)
        .insert(&space_action)
        .await
        .map_err(|e| {
            crate::error!("Failed to create follow action: {e}");
            SpaceFollowError::CreateFailed
        })?;
    tx.commit().await.map_err(|e| {
        crate::error!("Failed to commit follow: {e}");
        SpaceFollowError::CreateFailed
    })?;

    Ok(follow)
}
