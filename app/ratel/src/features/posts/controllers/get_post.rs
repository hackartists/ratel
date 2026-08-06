use std::collections::HashSet;

use crate::features::auth::OptionalUser;
use crate::features::posts::controllers::dto::*;
use crate::features::posts::models::*;
use crate::features::posts::types::*;
use crate::features::posts::*;
#[cfg(feature = "server")]
use uuid::Uuid;

#[mcp_tool(name = "get_post", description = "Get post details by ID.")]
#[get("/api/posts/:post_id", user: OptionalUser)]
pub async fn get_post_handler(post_id: FeedPartition) -> Result<PostDetailResponse> {
    let conf = crate::features::posts::config::get();
    let cli = conf.dynamodb();

    let user: Option<crate::features::auth::User> = user.into();
    let post_uuid = Uuid::parse_str(&post_id.0)
        .map_err(|_| Error::NotFound("Post not found".into()))?;
    tracing::debug!("Get post for post_id: {}", post_id.0);

    let post = Post::get_by_feed_id(post_uuid)
        .await?
        .ok_or(Error::NotFound("Post not found".into()))?;

    // Sub-team broadcast / direct-message Posts are NEVER publicly readable.
    use crate::features::sub_team::services::broadcast_access::PostBroadcastAccessExt;
    post.assert_broadcast_access(cli, user.as_ref().map(|u| u.pk()).as_ref())
        .await?;

    let permissions = post.get_permissions(cli, user.clone()).await?;
    if !permissions.contains(TeamGroupPermission::PostRead) {
        return Err(PostError::NotAccessible.into());
    }
    let can_read_space = permissions.contains(TeamGroupPermission::SpaceRead);

    // Fetch the post's colocated entities with separate Postgres queries
    // (there is no single-table "query all sk under pk" anymore).
    let comments = PostComment::list_top_level(post_uuid, 1, 100).await?.items;
    let artwork = PostArtwork::find_by_post(post_uuid).await?;
    let repost =
        PostRepost::find_by_owner(&Partition::Feed(post_uuid.to_string()).to_string()).await?;

    let (is_liked, liked_comment_ids) = if let Some(user) = &user {
        let is_liked = post.is_liked(&user.pk()).await?;
        let comment_ids: Vec<Uuid> = comments.iter().map(|c| c.id).collect();
        let liked = PostCommentLike::liked_comment_ids(&user.pk(), comment_ids).await?;
        (is_liked, liked)
    } else {
        (false, HashSet::new())
    };

    let mut metadata: Vec<PostMetadata> = Vec::with_capacity(comments.len() + 3);
    metadata.push(PostMetadata::Post(post.clone()));
    for comment in comments {
        metadata.push(PostMetadata::PostComment(comment));
    }
    if let Some(artwork) = artwork {
        metadata.push(PostMetadata::PostArtwork(artwork));
    }
    if let Some(repost) = repost {
        metadata.push(PostMetadata::PostRepost(repost));
    }

    let perms_i64: i64 = permissions.clone().into();
    let mut resp: PostDetailResponse = (
        metadata,
        perms_i64,
        is_liked,
        false, // is_report - skipping ContentReport for now
        liked_comment_ids,
        HashSet::<Uuid>::new(),
    )
        .into();

    // Direct role/ownership signals.
    if let Some(user) = &user {
        let author_pk = post.author_partition();
        if author_pk == user.pk() {
            resp.is_post_owner = true;
        }
        if matches!(author_pk, Partition::Team(_)) {
            resp.viewer_role = Team::get_user_role(cli, &author_pk, &user.pk()).await?;
        }
    }

    if !can_read_space {
        if let Some(p) = resp.post.as_mut() {
            p.space_pk = None;
            p.space_type = None;
            p.space_visibility = None;
        }
    }

    Ok(resp)
}
