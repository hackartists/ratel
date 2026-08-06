use crate::features::spaces::pages::actions::actions::meet::*;
#[cfg(feature = "server")]
use crate::features::spaces::space_common::models::aggregate::DashboardAggregate;

#[mcp_tool(
    name = "delete_meet",
    description = "Delete a meet action from a space. Requires creator role."
)]
#[delete("/api/spaces/{space_pk}/meets/{meet_sk}", role: SpaceUserRole)]
pub async fn delete_meet(
    #[mcp(description = "Space partition key")] space_pk: SpacePartition,
    #[mcp(description = "Meet sort key (e.g. 'SpaceMeet#<uuid>')")] meet_sk: SpaceMeetEntityType,
) -> Result<String> {
    SpaceMeet::can_edit(&role)?;

    let meet = SpaceMeet::get_one(&space_pk, &meet_sk)
        .await?
        .ok_or(MeetActionError::NotFound)?;

    SpaceMeet::repository().delete(meet.id).await.map_err(|e| {
        crate::error!("delete meet failed: {e}");
        MeetActionError::DeleteFailed
    })?;

    // Decrement meet count in aggregate.
    let space_pk_partition: Partition = space_pk.into();
    let _ = DashboardAggregate::inc_meets(&space_pk_partition, -1).await;

    Ok("success".to_string())
}
