use crate::common::models::space::{SpaceCommon, SpaceUser};
use crate::features::spaces::pages::actions::actions::discussion::*;

#[mcp_tool(
    name = "subscribe_discussion",
    description = "Subscribe the current member to a discussion. While subscribed, they receive a notification and email for every new comment or reply. Idempotent."
)]
#[post("/api/spaces/{space_id}/discussions/{discussion_sk}/subscribe", role: SpaceUserRole, member: SpaceUser, _space: SpaceCommon)]
pub async fn subscribe_discussion(
    #[mcp(description = "Space partition key")] space_id: SpacePartition,
    #[mcp(description = "Discussion sort key (e.g. 'SpacePost#<uuid>')")]
    discussion_sk: SpacePostEntityType,
) -> Result<()> {
    SpacePost::can_view(&role)?;
    let space_post_pk = SpacePostPartition(discussion_sk.0);

    // Guard with a point read to keep subscribe idempotent — already
    // subscribed is success.
    let exists = SpacePostSubscription::get_one(&space_post_pk, &member.pk)
        .await
        .map_err(|e| {
            crate::error!("subscribe_discussion existence check failed: {e}");
            SpaceActionDiscussionError::CreateFailed
        })?
        .is_some();
    if exists {
        return Ok(());
    }

    let sub = SpacePostSubscription::new(space_post_pk, space_id, &member.pk);
    SpacePostSubscription::repository()
        .insert(&sub)
        .await
        .map_err(|e| {
            crate::error!("subscribe_discussion failed: {e}");
            SpaceActionDiscussionError::CreateFailed
        })?;

    Ok(())
}
