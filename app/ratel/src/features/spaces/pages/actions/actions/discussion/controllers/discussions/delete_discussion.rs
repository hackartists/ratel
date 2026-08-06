use crate::features::spaces::pages::actions::actions::discussion::*;
use crate::features::spaces::space_common::models::aggregate::DashboardAggregate;

#[mcp_tool(name = "delete_discussion", description = "Delete a discussion from a space. Requires creator role.")]
#[delete("/api/spaces/{space_id}/discussions/{discussion_sk}", role: SpaceUserRole)]
pub async fn delete_discussion(
    #[mcp(description = "Space partition key")]
    space_id: SpacePartition,
    #[mcp(description = "Discussion sort key (e.g. 'SpacePost#<uuid>')")]
    discussion_sk: SpacePostEntityType,
) -> Result<()> {
    SpacePost::can_edit(&role)?;

    if let Some(post) = SpacePost::get_one(&space_id, &SpacePostPartition(discussion_sk.0)).await? {
        SpacePost::repository()
            .delete(post.id)
            .await
            .map_err(crate::common::Error::from)?;
    }

    // Decrement post count in aggregate.
    let space_pk: Partition = space_id.into();
    let _ = DashboardAggregate::inc_posts(&space_pk, -1).await;

    Ok(())
}
