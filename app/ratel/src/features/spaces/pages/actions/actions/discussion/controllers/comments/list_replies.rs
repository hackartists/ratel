use crate::features::spaces::pages::actions::actions::discussion::*;
use crate::{common::types::ListResponse, features::auth::OptionalUser};
use std::collections::HashSet;

#[get("/api/spaces/{space_id}/discussions/{discussion_sk}/comments/{comment_sk}/replies?bookmark", role: SpaceUserRole, user: OptionalUser)]
pub async fn list_replies(
    space_id: SpacePartition,
    discussion_sk: SpacePostEntityType,
    comment_sk: SpacePostCommentEntityType,
    bookmark: Option<String>,
) -> Result<ListResponse<DiscussionCommentResponse>> {
    SpacePost::can_view(&role)?;
    let _ = space_id;
    let space_post_pk = SpacePostPartition(discussion_sk.0);
    let post_id = space_post_pk.0.clone();
    let comment_sk_entity: EntityType = comment_sk.into();

    let (replies, next_bookmark) =
        SpacePostComment::list_by_comment(comment_sk_entity, bookmark, 50).await?;

    // Moderation: drop auto-hidden comments (App Store req #2) and comments
    // authored by someone the viewer personally blocked (req #4).
    let blocked = crate::common::models::moderation::blocked_author_set(
        user.0.as_ref().map(|u| u.pk()).as_ref(),
    )
    .await;
    let replies = crate::common::models::moderation::retain_visible(
        replies,
        &blocked,
        |c| c.hidden,
        |c| c.author_pk.as_str(),
    );

    let liked_set: HashSet<String> = if let Some(ref u) = user.0 {
        let keys: Vec<String> = replies.iter().map(|r| r.like_key()).collect();
        SpacePostCommentLike::liked_keys(&post_id, &u.pk(), keys)
            .await
            .unwrap_or_default()
    } else {
        HashSet::new()
    };

    let responses: Vec<DiscussionCommentResponse> = replies
        .into_iter()
        .map(|r| {
            let liked = liked_set.contains(&r.like_key());
            (r, liked).into()
        })
        .collect();

    Ok(ListResponse {
        items: responses,
        bookmark: next_bookmark,
    })
}
