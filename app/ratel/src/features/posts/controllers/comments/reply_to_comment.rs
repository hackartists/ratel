use crate::features::posts::models::*;
use crate::features::posts::*;
use crate::features::auth::User;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub struct ReplyToPostCommentRequest {
    pub content: String,
    #[serde(default)]
    pub images: Vec<String>,
}

#[post("/api/posts/:post_id/comments/:comment_id/reply", user: User)]
pub async fn reply_to_comment_handler(
    post_id: FeedPartition,
    comment_id: PostCommentEntityType,
    req: ReplyToPostCommentRequest,
) -> Result<PostComment> {
    let post_uuid = uuid::Uuid::parse_str(&post_id.0)
        .map_err(|_| Error::NotFound("Post not found".into()))?;
    let parent_et: EntityType = comment_id.into();
    let parent_uuid = match &parent_et {
        EntityType::PostComment(id) | EntityType::PostCommentReply(_, id) => {
            uuid::Uuid::parse_str(id)
                .map_err(|_| Error::NotFound("Comment not found".into()))?
        }
        _ => return Err(crate::features::posts::types::PostError::ReplyFailed.into()),
    };

    tracing::debug!("Handling reply to comment: {:?}", parent_uuid);

    // Preserved notification key shape (parent comment's canonical keys).
    let parent_pk_str = Partition::Feed(post_uuid.to_string()).to_string();
    let parent_sk_str = EntityType::PostComment(parent_uuid.to_string()).to_string();

    let comment = PostComment::reply(
        post_uuid,
        parent_uuid,
        req.content,
        req.images,
        user.clone(),
    )
    .await?;

    // Essence indexing happens via the DynamoDB Stream pipeline.

    let cta_url = format!(
        "{}/posts/{}",
        crate::common::config::site_base_url(),
        post_id
    );

    // Send mention notifications
    crate::common::utils::mention::create_mention_notifications(
        &comment.content,
        &user.pk(),
        &user.display_name,
        &cta_url,
    )
    .await;

    // Fire reply-on-comment notification. Recipient resolution (parent author +
    // thread participants → emails) runs at send time, not here — the handler
    // only persists one notification row and returns.
    {
        let notification =
            crate::common::models::notification::Notification::new(
                crate::common::types::NotificationData::ReplyOnComment {
                    source: crate::common::utils::reply_notification::ReplyCommentSource::Post,
                    parent_comment_pk: parent_pk_str,
                    parent_comment_sk: parent_sk_str,
                    replier_pk: user.pk().to_string(),
                    replier_name: user.display_name.clone(),
                    reply_content: comment.content.clone(),
                    cta_url,
                },
            );
        if let Err(e) = notification.create().await {
            tracing::error!("Failed to enqueue reply-on-comment notification: {}", e);
        }
    }

    Ok(comment)
}
