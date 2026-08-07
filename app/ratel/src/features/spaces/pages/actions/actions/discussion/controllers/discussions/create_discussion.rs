use crate::features::spaces::pages::actions::actions::discussion::*;

#[mcp_tool(
    name = "create_discussion",
    description = "Create a new discussion in a space."
)]
#[post("/api/spaces/{space_id}/discussions", role: SpaceUserRole, member: crate::common::models::space::SpaceUser, _space: crate::common::models::space::SpaceCommon)]
pub async fn create_discussion(
    #[mcp(description = "Space partition key (e.g. 'SPACE#<uuid>')")] space_id: SpacePartition,
) -> Result<SpacePost> {
    SpacePost::can_edit(&role)?;
    let common_config = crate::common::CommonConfig::default();
    let cli = common_config.dynamodb();
    let post = SpacePost::new(
        space_id.clone(),
        String::new(),
        String::new(),
        String::new(),
        &member,
        None,
        None,
    );

    let space_action = crate::features::spaces::pages::actions::models::SpaceAction::new(
        space_id.clone(),
        post.post_id.clone(),
        crate::features::spaces::pages::actions::types::SpaceActionType::TopicDiscussion,
    );

    // Auto-subscribe the author to their own discussion so they receive a
    // notification for every comment/reply.
    let author_subscription = SpacePostSubscription::new(
        SpacePostPartition(post.post_id.clone()),
        space_id.clone(),
        &member.pk,
    );

    // Postgres side: post + companion action + author subscription atomically.
    let tx = postgres::Tx::begin().await.map_err(|e| {
        crate::error!("Failed to begin tx: {e}");
        SpaceActionDiscussionError::CreateFailed
    })?;
    SpacePost::repository()
        .with_tx(&tx)
        .insert(&post)
        .await
        .map_err(|e| {
            crate::error!("Failed to create discussion: {e}");
            SpaceActionDiscussionError::CreateFailed
        })?;
    crate::features::spaces::pages::actions::models::SpaceAction::repository()
        .with_tx(&tx)
        .insert(&space_action)
        .await
        .map_err(|e| {
            crate::error!("Failed to create discussion action: {e}");
            SpaceActionDiscussionError::CreateFailed
        })?;
    SpacePostSubscription::repository()
        .with_tx(&tx)
        .insert(&author_subscription)
        .await
        .map_err(|e| {
            crate::error!("Failed to subscribe author: {e}");
            SpaceActionDiscussionError::CreateFailed
        })?;
    // Emit outbox event (Phase 5) — AiModeratorReplyCheck rule on SPACE_POST# INSERT.
    crate::common::events::outbox::EventOutbox::emit_insert_tx(
        &tx,
        crate::common::events::outbox::topic::SPACE_POST,
        &post,
    )
    .await
    .map_err(|_| SpaceActionDiscussionError::CreateFailed)?;
    tx.commit().await.map_err(|e| {
        crate::error!("Failed to commit discussion: {e}");
        SpaceActionDiscussionError::CreateFailed
    })?;

    // Bump the (now Postgres-backed) dashboard aggregate.
    let space_pk: Partition = space_id.into();
    let _ =
        crate::features::spaces::space_common::models::aggregate::DashboardAggregate::get_or_create(&space_pk).await?;
    let _ = crate::features::spaces::space_common::models::aggregate::DashboardAggregate::inc_posts(&space_pk, 1)
        .await;

    crate::features::spaces::space_common::services::bump_participant_activity(
        cli, &space_pk, &member.pk,
    )
    .await;

    Ok(post)
}
