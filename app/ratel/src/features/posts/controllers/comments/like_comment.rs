use crate::features::posts::models::*;
use crate::features::posts::types::PostCommentTargetEntityType;
use crate::features::posts::*;
use crate::features::auth::User;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub struct LikeCommentResponse {
    pub liked: bool,
}

#[post("/api/posts/:post_id/comments/:comment_id/like", user: User)]
pub async fn like_comment_handler(
    post_id: FeedPartition,
    comment_id: PostCommentTargetEntityType,
    liked: bool,
) -> Result<LikeCommentResponse> {
    let post_uuid = uuid::Uuid::parse_str(&post_id.0)
        .map_err(|_| Error::NotFound("Post not found".into()))?;

    // `PostCommentTargetEntityType.0` is either `<id>` (top-level comment) or
    // `<parent>::<reply>` (a reply); the liked comment's own id is the last
    // segment.
    let raw = comment_id.0;
    let comment_str = raw.rsplit_once("::").map(|(_, r)| r).unwrap_or(raw.as_str());
    let comment_uuid = uuid::Uuid::parse_str(comment_str)
        .map_err(|_| Error::NotFound("Comment not found".into()))?;

    tracing::debug!("Handling like comment request: like = {}", liked);

    if liked {
        Post::like_comment(post_uuid, comment_uuid, user.pk()).await?;
    } else {
        Post::unlike_comment(post_uuid, comment_uuid, user.pk()).await?;
    }

    Ok(LikeCommentResponse { liked })
}
