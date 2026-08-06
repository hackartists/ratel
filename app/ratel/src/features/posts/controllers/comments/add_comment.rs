use crate::features::posts::models::*;
use crate::features::posts::types::*;
use crate::features::posts::*;
use crate::features::auth::User;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub struct AddPostCommentRequest {
    pub content: String,
    #[serde(default)]
    pub images: Vec<String>,
}

#[post("/api/posts/:post_id/comments", user: User)]
pub async fn add_comment_handler(
    post_id: FeedPartition,
    req: AddPostCommentRequest,
) -> Result<PostComment> {
    let conf = crate::features::posts::config::get();
    let cli = conf.dynamodb();

    let post_uuid = uuid::Uuid::parse_str(&post_id.0)
        .map_err(|_| Error::NotFound("Post not found".into()))?;

    let post = Post::get_by_feed_id(post_uuid)
        .await?
        .ok_or(Error::NotFound("Post not found".into()))?;

    match post.author_partition() {
        team_pk if matches!(team_pk, Partition::Team(_)) => {
            Team::has_permission(cli, &team_pk, &user.pk(), TeamGroupPermission::PostRead).await?;
        }
        _ => {}
    }

    let comment = Post::comment(post_uuid, req.content, req.images, user.clone()).await?;

    // Essence indexing happens via the DynamoDB Stream pipeline.

    // Send mention notifications
    {
        let cta_url = format!(
            "{}/posts/{}",
            crate::common::config::site_base_url(),
            post_id
        );
        crate::common::utils::mention::create_mention_notifications(
            &comment.content,
            &user.pk(),
            &user.display_name,
            &cta_url,
        )
        .await;
    }

    Ok(comment)
}
