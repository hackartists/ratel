use crate::common::models::space::SpaceCommon;
use crate::features::spaces::pages::actions::actions::discussion::*;
use crate::features::spaces::pages::actions::models::SpaceAction;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCommentRequest {
    pub content: String,
    #[serde(default)]
    pub images: Option<Vec<String>>,
}

#[post("/api/spaces/{space_id}/discussions/{discussion_sk}/comments/{comment_sk}", role: SpaceUserRole, user: crate::features::auth::User, space: SpaceCommon)]
pub async fn update_comment(
    space_id: SpacePartition,
    discussion_sk: SpacePostEntityType,
    comment_sk: SpacePostCommentTargetEntityType,
    req: UpdateCommentRequest,
) -> Result<SpacePostComment> {
    SpacePost::can_view(&role)?;
    let space_action = SpaceAction::get_one(&space_id, &discussion_sk.0)
        .await?
        .ok_or(Error::SpaceActionNotFound)?;

    let deps_met = crate::features::spaces::pages::actions::services::dependency::dependencies_met(
        &space,
        &space_action,
        &user.pk(),
    )
    .await?;

    if !crate::features::spaces::pages::actions::can_execute_space_action(
        role,
        space_action.prerequisite,
        space.status,
        space_action.status.as_ref(),
        deps_met,
        space.join_anytime,
    ) {
        return Err(SpaceActionDiscussionError::NotAvailableInCurrentStatus.into());
    }

    let space_post_id = SpacePostPartition(discussion_sk.0.clone());
    let _post = SpacePost::get_one(&space_id, &space_post_id)
        .await?
        .ok_or(SpaceActionDiscussionError::NotFound)?;

    let comment_sk_entity: EntityType = comment_sk.into();

    let mut comment = SpacePostComment::get_by_entity(&space_post_id, &comment_sk_entity)
        .await?
        .ok_or(Error::NotFound("Comment not found".into()))?;

    // Only the author can update
    if comment.author_partition() != user.pk() {
        return Err(Error::NoPermission);
    }

    let now = chrono::Utc::now().timestamp();
    // Only touch `content` / `updated_at` / `images`.
    comment.content = req.content;
    comment.updated_at = now;
    if let Some(images) = req.images {
        comment.images = CommentImages(images);
    }

    let comment = SpacePostComment::repository()
        .upsert(&comment)
        .await
        .map_err(crate::common::Error::from)?;

    // Essence re-indexing happens via the DynamoDB Stream pipeline.

    Ok(comment)
}
