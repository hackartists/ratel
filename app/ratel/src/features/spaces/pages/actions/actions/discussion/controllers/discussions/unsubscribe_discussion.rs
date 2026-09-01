use crate::common::models::space::{SpaceCommon, SpaceUser};
use crate::features::spaces::pages::actions::actions::discussion::*;

#[mcp_tool(
    name = "unsubscribe_discussion",
    description = "Unsubscribe the current member from a discussion so they stop receiving comment notifications and emails."
)]
#[delete("/api/spaces/{space_id}/discussions/{discussion_sk}/subscribe", role: SpaceUserRole, member: SpaceUser, _space: SpaceCommon)]
pub async fn unsubscribe_discussion(
    #[mcp(description = "Space partition key")] space_id: SpacePartition,
    #[mcp(description = "Discussion sort key (e.g. 'SpacePost#<uuid>')")]
    discussion_sk: SpacePostEntityType,
) -> Result<()> {
    SpacePost::can_view(&role)?;
    // The discussion author (space Creator) always stays subscribed to their own
    // discussion — reject unsubscribe defensively (the UI also disables it).
    if matches!(role, SpaceUserRole::Creator) {
        return Err(SpaceActionDiscussionError::CannotUnsubscribeOwnDiscussion.into());
    }
    let _ = space_id;

    let space_post_pk = SpacePostPartition(discussion_sk.0);

    // Deleting a non-existent row is a no-op, so unsubscribe is idempotent.
    if let Some(existing) = SpacePostSubscription::get_one(&space_post_pk, &member.pk)
        .await
        .map_err(|e| {
            crate::error!("unsubscribe_discussion failed: {e}");
            SpaceActionDiscussionError::CreateFailed
        })?
    {
        SpacePostSubscription::repository()
            .delete(existing.id)
            .await
            .map_err(|e| {
                crate::error!("unsubscribe_discussion failed: {e}");
                SpaceActionDiscussionError::CreateFailed
            })?;
    }

    Ok(())
}
