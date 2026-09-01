use crate::common::types::ListResponse;
use crate::features::auth::OptionalUser;

use crate::features::spaces::pages::actions::actions::discussion::*;
use std::collections::HashSet;

#[mcp_tool(name = "list_comments", description = "List comments on a discussion, sorted by likes. Supports pagination. Pass `since` (unix seconds) to fetch only comments created after that time, ordered newest-first with no pagination.")]
#[get("/api/spaces/{space_id}/discussions/{discussion_sk}/comments?bookmark&since", role: SpaceUserRole, user: OptionalUser)]
pub async fn list_comments(
    #[mcp(description = "Space partition key")]
    space_id: SpacePartition,
    #[mcp(description = "Discussion sort key (e.g. 'SpacePost#<uuid>')")]
    discussion_sk: SpacePostEntityType,
    #[mcp(description = "Pagination bookmark. Omit for first page.")]
    bookmark: Option<String>,
    #[mcp(description = "Unix seconds timestamp. When set, returns only top-level comments with created_at > since, newest-first, no pagination.")]
    since: Option<i64>,
) -> Result<ListResponse<DiscussionCommentResponse>> {
    SpacePost::can_view(&role)?;
    let space_post_pk = SpacePostPartition(discussion_sk.0);
    let post_id = space_post_pk.0.clone();

    // Polling branch fetches only top-level comments newer than `since`,
    // newest-first, unpaginated. Otherwise a normal newest-first page. The
    // client re-ranks by `comment_score`, so server order is just a stable
    // fetch order.
    let (comments, next_bookmark): (Vec<SpacePostComment>, Option<String>) =
        if let Some(since_ts) = since {
            let items = SpacePostComment::list_top_level_since(&post_id, since_ts, 50).await?;
            (items, None)
        } else {
            SpacePostComment::list_top_level(&post_id, bookmark, 100).await?
        };


    // Moderation: drop auto-hidden comments (App Store req #2) and comments
    // authored by someone the viewer personally blocked (req #4).
    let blocked = crate::common::models::moderation::blocked_author_set(
        user.0.as_ref().map(|u| u.pk()).as_ref(),
    )
    .await;
    let comments = crate::common::models::moderation::retain_visible(
        comments,
        &blocked,
        |c| c.hidden,
        |c| c.author_pk.as_str(),
    );

    // Check which comments the current user has liked.
    let liked_set: HashSet<String> = if let Some(ref u) = user.0 {
        let keys: Vec<String> = comments.iter().map(|c| c.like_key()).collect();
        SpacePostCommentLike::liked_keys(&post_id, &u.pk(), keys)
            .await
            .unwrap_or_default()
    } else {
        HashSet::new()
    };

    // Check which comments the current user has already reported (dedup shown
    // in the UI so the "Report" action is hidden after the first report).
    let reported_set: HashSet<String> = if let Some(ref u) = user.0 {
        let keys: Vec<_> = comments
            .iter()
            .filter_map(|c| SpacePostCommentReport::keys(&space_post_pk_p, &c.sk, &u.pk))
            .collect();
        SpacePostCommentReport::batch_get(cli, keys)
            .await
            .unwrap_or_default()
            .into_iter()
            .map(|r| r.comment_sk.to_string())
            .collect()
    } else {
        HashSet::new()
    };

    let responses: Vec<DiscussionCommentResponse> = comments
        .into_iter()
        .map(|c| {
            let liked = liked_set.contains(&c.like_key());
            (c, liked).into()
        })
        .collect();

    Ok(ListResponse {
        items: responses,
        bookmark: next_bookmark,
    })
}
