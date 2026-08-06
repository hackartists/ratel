use crate::features::spaces::pages::actions::actions::poll::*;
use crate::features::spaces::pages::actions::models::SpaceAction;
#[cfg(feature = "server")]
use crate::features::spaces::space_common::models::aggregate::DashboardAggregate;

#[mcp_tool(
    name = "create_poll",
    description = "Create a new poll action in a space. Requires creator role."
)]
#[post("/api/spaces/{space_pk}/polls", role: SpaceUserRole, space: crate::common::models::space::SpaceCommon)]
pub async fn create_poll(
    #[mcp(description = "Space partition key")] space_pk: SpacePartition,
) -> Result<PollResponse> {
    SpacePoll::can_edit(&role)?;
    let poll = SpacePoll::new(space_pk.clone())?;

    let space_action = SpaceAction::new(
        space_pk.clone(),
        poll.poll_id.clone(),
        crate::features::spaces::pages::actions::types::SpaceActionType::Poll,
    );

    // Postgres side: insert poll + companion action atomically.
    let tx = postgres::Tx::begin().await.map_err(|e| {
        crate::error!("Failed to begin tx: {e}");
        SpacePollError::CreateFailed
    })?;
    SpacePoll::repository()
        .with_tx(&tx)
        .insert(&poll)
        .await
        .map_err(|e| {
            crate::error!("Failed to create poll: {e}");
            SpacePollError::CreateFailed
        })?;
    SpaceAction::repository()
        .with_tx(&tx)
        .insert(&space_action)
        .await
        .map_err(|e| {
            crate::error!("Failed to create poll action: {e}");
            SpacePollError::CreateFailed
        })?;
    tx.commit().await.map_err(|e| {
        crate::error!("Failed to commit poll: {e}");
        SpacePollError::CreateFailed
    })?;

    // Bump the (now Postgres-backed) dashboard aggregate.
    let space_pk_partition: Partition = space_pk.into();
    let _ = DashboardAggregate::get_or_create(&space_pk_partition).await?;
    DashboardAggregate::inc_polls(&space_pk_partition, 1)
        .await
        .map_err(|e| {
            crate::error!("Failed to bump poll aggregate: {e}");
            SpacePollError::CreateFailed
        })?;

    // Essence indexing happens via the DynamoDB Stream pipeline.

    let mut ret: PollResponse = poll.into();
    ret.space_action = space_action;

    Ok(ret)
}
