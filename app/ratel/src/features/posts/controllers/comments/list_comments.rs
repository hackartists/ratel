use crate::features::posts::controllers::dto::*;
use crate::features::posts::models::*;
use crate::features::posts::*;
use crate::features::auth::OptionalUser;

#[get("/api/posts/:post_id/comments/:comment_id?bookmark", user: OptionalUser)]
pub async fn list_comments_handler(
    post_id: FeedPartition,
    comment_id: PostCommentEntityType,
    bookmark: Option<String>,
) -> Result<ListItemsResponse<PostCommentResponse>> {
    let _ = post_id;
    let user: Option<crate::features::auth::User> = user.into();

    // The parent comment whose replies we list. Its own id is the comment uuid.
    let parent_et: EntityType = comment_id.into();
    let parent_uuid = match parent_et {
        EntityType::PostComment(id) | EntityType::PostCommentReply(_, id) => {
            uuid::Uuid::parse_str(&id)
                .map_err(|_| Error::NotFound("Comment not found".into()))?
        }
        _ => return Err(crate::features::posts::types::PostError::InvalidCommentKey.into()),
    };

    // `bookmark` carries an opaque 1-based page number (Postgres pagination).
    let page: i64 = bookmark
        .as_deref()
        .and_then(|b| b.parse::<i64>().ok())
        .filter(|p| *p >= 1)
        .unwrap_or(1);

    let result = PostComment::list_by_comment(parent_uuid, page, 10).await?;
    let next_bookmark = if page < result.total_pages {
        Some((page + 1).to_string())
    } else {
        None
    };
    let comments = result.items;

    let liked_ids = if let Some(user) = &user {
        let ids: Vec<uuid::Uuid> = comments.iter().map(|c| c.id).collect();
        PostCommentLike::liked_comment_ids(&user.pk(), ids).await?
    } else {
        Default::default()
    };

    let items = comments
        .into_iter()
        .map(|comment| {
            let liked = liked_ids.contains(&comment.id);
            PostCommentResponse::from((comment, liked, false))
        })
        .collect();

    Ok(ListItemsResponse {
        items,
        bookmark: next_bookmark,
    })
}
