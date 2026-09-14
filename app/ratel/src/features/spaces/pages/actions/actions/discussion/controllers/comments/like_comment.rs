use crate::features::spaces::pages::actions::actions::discussion::*;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct LikeCommentRequest {
    pub like: bool,
}

#[post("/api/spaces/{space_id}/discussions/{discussion_sk}/comments/{comment_sk}/likes", role: SpaceUserRole, user: crate::features::auth::User)]
pub async fn like_comment(
    space_id: SpacePartition,
    discussion_sk: SpacePostEntityType,
    comment_sk: SpacePostCommentTargetEntityType,
    req: LikeCommentRequest,
) -> Result<()> {
    SpacePost::can_view(&role)?;
    let space_post_pk = SpacePostPartition(discussion_sk.0.clone());

    let comment_sk_entity: EntityType = comment_sk.into();
    let user_pk: UserPartition = user
        .pk()
        .try_into()
        .map_err(|_| Error::NoPermission)?;

    if req.like {
        SpacePost::like_comment(space_post_pk, comment_sk_entity, user_pk).await?;
    } else {
        SpacePost::unlike_comment(space_post_pk, comment_sk_entity, user_pk).await?;
    }

    let space_pk: Partition = space_id.into();
    let delta = if req.like { 1 } else { -1 };
    let _ = crate::features::spaces::space_common::models::aggregate::DashboardAggregate::inc_likes(&space_pk, delta).await;

    Ok(())
}
