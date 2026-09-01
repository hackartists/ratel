use crate::features::auth::OptionalUser;
use crate::features::spaces::pages::actions::actions::discussion::*;

// Single-comment fetch backing the dedicated replies page — the mobile
// "reply" navigation lands there cold (no cached thread state), so it
// needs to pull the parent on its own without refetching the whole
// discussion page.
#[get("/api/spaces/{space_id}/discussions/{discussion_sk}/comments/{comment_sk}", role: SpaceUserRole, user: OptionalUser)]
pub async fn get_comment(
    space_id: SpacePartition,
    discussion_sk: SpacePostEntityType,
    comment_sk: SpacePostCommentEntityType,
) -> Result<DiscussionCommentResponse> {
    SpacePost::can_view(&role)?;
    let _ = space_id;

    let space_post_pk = SpacePostPartition(discussion_sk.0);
    let comment_sk_entity: EntityType = comment_sk.into();

    let comment = SpacePostComment::get_by_entity(&space_post_pk, &comment_sk_entity)
        .await?
        .ok_or(SpaceActionDiscussionError::NotFound)?;

    let liked = if let Some(ref u) = user.0 {
        let set = SpacePostCommentLike::liked_keys(&space_post_pk.0, &u.pk(), vec![comment.like_key()])
            .await
            .unwrap_or_default();
        set.contains(&comment.like_key())
    } else {
        false
    };

    Ok((comment, liked).into())
}
