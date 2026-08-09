use crate::features::auth::User;
use crate::features::posts::models::*;
use crate::features::posts::*;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub struct LikePostResponse {
    pub like: bool,
}

#[mcp_tool(name = "like_post", description = "Like or unlike a post.")]
#[post("/api/posts/:post_id/like", user: User)]
pub async fn like_post_handler(post_id: FeedPartition, like: bool) -> Result<LikePostResponse> {
    let post_uuid = uuid::Uuid::parse_str(&post_id.0)
        .map_err(|_| Error::NotFound("Post not found".into()))?;

    if like {
        Post::like(post_uuid, user.pk()).await?;

        Ok(LikePostResponse { like: true })
    } else {
        Post::unlike(post_uuid, user.pk()).await?;
        Ok(LikePostResponse { like: false })
    }
}
