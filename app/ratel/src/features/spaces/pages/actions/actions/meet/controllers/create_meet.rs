use crate::features::spaces::pages::actions::actions::meet::*;
use crate::features::spaces::pages::actions::models::SpaceAction;
#[cfg(feature = "server")]
use crate::features::spaces::space_common::models::aggregate::DashboardAggregate;

#[mcp_tool(
    name = "create_meet",
    description = "Create a new meet action in a space. Requires creator role."
)]
#[post("/api/spaces/{space_pk}/meets", role: SpaceUserRole, space: crate::common::models::space::SpaceCommon)]
pub async fn create_meet(
    #[mcp(description = "Space partition key")] space_pk: SpacePartition,
) -> Result<MeetResponse> {
    SpaceMeet::can_edit(&role)?;
    let meet = SpaceMeet::new(space_pk.clone())?;

    let space_action = SpaceAction::new(
        space_pk.clone(),
        meet.meet_id.clone(),
        crate::features::spaces::pages::actions::types::SpaceActionType::Meet,
    );

    // Postgres side: insert the meet + its companion action row atomically.
    let tx = postgres::Tx::begin().await.map_err(|e| {
        crate::error!("Failed to begin tx: {e}");
        MeetActionError::CreateFailed
    })?;
    SpaceMeet::repository()
        .with_tx(&tx)
        .insert(&meet)
        .await
        .map_err(|e| {
            crate::error!("Failed to create meet: {e}");
            MeetActionError::CreateFailed
        })?;
    SpaceAction::repository()
        .with_tx(&tx)
        .insert(&space_action)
        .await
        .map_err(|e| {
            crate::error!("Failed to create meet action: {e}");
            MeetActionError::CreateFailed
        })?;
    tx.commit().await.map_err(|e| {
        crate::error!("Failed to commit meet: {e}");
        MeetActionError::CreateFailed
    })?;

    // Bump the (now Postgres-backed) dashboard aggregate.
    let space_pk_partition: Partition = space_pk.into();
    let _ = DashboardAggregate::get_or_create(&space_pk_partition).await?;
    DashboardAggregate::inc_meets(&space_pk_partition, 1)
        .await
        .map_err(|e| {
            crate::error!("Failed to bump meet aggregate: {e}");
            MeetActionError::CreateFailed
        })?;

    let mut ret: MeetResponse = meet.into();
    ret.space_action = space_action;
    Ok(ret)
}
