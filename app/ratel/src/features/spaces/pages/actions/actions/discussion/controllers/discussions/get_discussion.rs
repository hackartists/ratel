use crate::features::spaces::pages::actions::actions::discussion::*;

#[mcp_tool(name = "get_discussion", description = "Get discussion details by ID.")]
#[get("/api/spaces/{space_id}/discussions/{discussion_sk}", role: SpaceUserRole)]
pub async fn get_discussion(
    #[mcp(description = "Space partition key")]
    space_id: SpacePartition,
    #[mcp(description = "Discussion sort key (e.g. 'SpacePost#<uuid>')")]
    discussion_sk: SpacePostEntityType,
) -> Result<SpacePost> {
    SpacePost::can_view(&role)?;

    let post = SpacePost::get_one(&space_id, &SpacePostPartition(discussion_sk.0))
        .await?
        .ok_or(SpaceActionDiscussionError::NotFound)?;

    Ok(post)
}
