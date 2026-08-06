use crate::features::spaces::pages::actions::actions::follow::*;
use crate::features::spaces::pages::actions::models::SpaceAction;

#[mcp_tool(name = "get_follow", description = "Get follow action details including the target user to follow.")]
#[get("/api/spaces/{space_pk}/follows/{follow_id}", role: SpaceUserRole)]
pub async fn get_follow(
    #[mcp(description = "Space partition key")]
    space_pk: SpacePartition,
    #[mcp(description = "Follow action sort key (e.g. 'SpaceActionFollow#<uuid>')")]
    follow_id: SpaceActionFollowEntityType,
) -> Result<SpaceAction> {
    let space_action = SpaceAction::get_one(&space_pk, &follow_id.0)
        .await?
        .ok_or(Error::NotFound("Follow action not found".into()))?;

    Ok(space_action)
}
