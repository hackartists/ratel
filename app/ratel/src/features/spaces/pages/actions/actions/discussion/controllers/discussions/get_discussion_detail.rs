use crate::features::spaces::pages::actions::actions::discussion::*;

#[get("/api/spaces/{space_id}/discussions/{discussion_sk}/detail", role: SpaceUserRole, user: crate::common::models::OptionalUser)]
pub async fn get_discussion_detail(
    space_id: SpacePartition,
    discussion_sk: SpacePostEntityType,
) -> Result<DiscussionResponse> {
    SpacePost::can_view(&role)?;
    let space_post_pk = SpacePostPartition(discussion_sk.0.clone());

    let post = SpacePost::get_one(&space_id, &space_post_pk)
        .await?
        .ok_or(SpaceActionDiscussionError::NotFound)?;

    let space_action = crate::features::spaces::pages::actions::models::SpaceAction::get_one(
        &space_id,
        &discussion_sk.0,
    )
    .await?
    .ok_or(Error::NotFound("SpaceAction not found".into()))?;

    let subscribed = if let Some(u) = &user.0 {
        SpacePostSubscription::get_one(&space_post_pk, &u.pk())
            .await
            .map_err(|e| {
                crate::error!("get_discussion_detail subscribed check failed: {e}");
                SpaceActionDiscussionError::NotFound
            })?
            .is_some()
    } else {
        false
    };

    Ok(DiscussionResponse {
        post,
        space_action,
        subscribed,
    })
}
