use crate::common::models::space::SpaceCommon;
use crate::features::spaces::pages::actions::actions::discussion::*;
use crate::features::spaces::pages::actions::models::SpaceAction;

#[delete("/api/spaces/{space_id}/discussions/{discussion_sk}/comments/{comment_sk}", role: SpaceUserRole, user : crate::features::auth::User, space: SpaceCommon)]
pub async fn delete_comment(
    space_id: SpacePartition,
    discussion_sk: SpacePostEntityType,
    comment_sk: SpacePostCommentTargetEntityType,
) -> Result<()> {
    SpacePost::can_view(&role)?;

    let space_post_id = SpacePostPartition(discussion_sk.0.clone());
    let space_action = SpaceAction::get_one(&space_id, &discussion_sk.0)
        .await?
        .ok_or(Error::SpaceActionNotFound)?;

    let deps_met = crate::features::spaces::pages::actions::services::dependency::dependencies_met(
        &space,
        &space_action,
        &user.pk(),
    )
    .await?;

    let req_attrs_met = crate::features::spaces::pages::actions::services::required_attributes::required_attributes_met(
        &space,
        &space_action,
        &user.pk(),
    )
    .await?;

    if !crate::features::spaces::pages::actions::can_execute_space_action(
        role,
        space_action.prerequisite,
        space.status.clone(),
        space_action.status.as_ref(),
        deps_met,
        req_attrs_met,
        space.is_participation_open(),
    ) {
        return Err(SpaceActionDiscussionError::NotAvailableInCurrentStatus.into());
    }

    let post = SpacePost::get_one(&space_id, &space_post_id)
        .await?
        .ok_or(SpaceActionDiscussionError::NotFound)?;
    let comment_sk_entity: EntityType = comment_sk.into();

    let comment = SpacePostComment::get_by_entity(&space_post_id, &comment_sk_entity)
        .await?
        .ok_or(Error::NotFound("Comment not found".into()))?;

    if comment.author_partition() != user.pk() {
        return Err(Error::NoPermission);
    }

    // Postgres: delete comment + decrement the discussion comment count, and
    // (for replies) decrement the parent's reply count — atomically.
    let tx = postgres::Tx::begin()
        .await
        .map_err(crate::common::Error::from)?;
    // Emit outbox event (Phase 5) — EssenceDeleteDiscussionComment rule on
    // SPACE_POST_COMMENT# REMOVE.
    crate::common::events::outbox::EventOutbox::emit_remove_tx(
        &tx,
        crate::common::events::outbox::topic::SPACE_POST_COMMENT,
        &comment,
    )
    .await
    .map_err(|_| SpaceActionDiscussionError::DeleteFailed)?;
    SpacePostComment::repository()
        .with_tx(&tx)
        .delete(comment.id)
        .await
        .map_err(|e| {
            crate::error!("Failed to delete comment: {}", e);
            SpaceActionDiscussionError::DeleteFailed
        })?;
    SpacePost::bump_comments_public_tx(&tx, post.id, -1)
        .await
        .map_err(|e| {
            crate::error!("Failed to delete comment: {}", e);
            SpaceActionDiscussionError::DeleteFailed
        })?;
    if !comment.parent_comment_id.is_empty() {
        if let Some(parent) =
            SpacePostComment::get_by_leaf(&space_post_id.0, &comment.parent_comment_id).await?
        {
            SpacePostComment::bump_replies_tx(&tx, parent.id, -1)
                .await
                .map_err(|e| {
                    crate::error!("Failed to delete comment: {}", e);
                    SpaceActionDiscussionError::DeleteFailed
                })?;
        }
    }
    tx.commit().await.map_err(|e| {
        crate::error!("Failed to delete comment: {}", e);
        SpaceActionDiscussionError::DeleteFailed
    })?;

    // Decrement the dashboard aggregate.
    let space_pk: Partition = space_id.into();
    let _ =
        crate::features::spaces::space_common::models::aggregate::DashboardAggregate::inc_comments(
            &space_pk, -1,
        )
        .await;

    Ok(())
}
