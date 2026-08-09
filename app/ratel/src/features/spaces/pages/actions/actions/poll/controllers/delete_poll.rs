use crate::features::spaces::pages::actions::actions::poll::*;
#[cfg(feature = "server")]
use crate::features::spaces::space_common::models::aggregate::DashboardAggregate;

#[mcp_tool(name = "delete_poll", description = "Delete a poll from a space. Requires creator role.")]
#[delete("/api/spaces/{space_pk}/polls/{poll_sk}", role: SpaceUserRole)]
pub async fn delete_poll(
    #[mcp(description = "Space partition key")]
    space_pk: SpacePartition,
    #[mcp(description = "Poll sort key (e.g. 'SpacePoll#<uuid>')")]
    poll_sk: SpacePollEntityType,
) -> Result<String> {
    SpacePoll::can_edit(&role)?;

    let poll = SpacePoll::get_one(&space_pk, &poll_sk)
        .await?
        .ok_or(Error::NotFound("Poll not found".into()))?;

    // Emit outbox event (Phase 5) — EssenceDeletePoll rule on SPACE_POLL# REMOVE.
    crate::common::events::outbox::EventOutbox::emit_remove(
        crate::common::events::outbox::topic::SPACE_POLL,
        &poll,
    )
    .await
    .ok();

    SpacePoll::repository()
        .delete(poll.id)
        .await
        .map_err(crate::common::Error::from)?;

    // Decrement poll count in aggregate.
    let space_pk_partition: Partition = space_pk.into();
    let _ = DashboardAggregate::inc_polls(&space_pk_partition, -1).await;

    Ok("success".to_string())
}
