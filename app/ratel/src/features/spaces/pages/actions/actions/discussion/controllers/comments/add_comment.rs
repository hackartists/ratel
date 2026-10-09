use crate::common::models::space::{SpaceCommon, SpaceUser};
use crate::features::spaces::pages::actions::actions::discussion::*;
use crate::features::spaces::pages::actions::models::SpaceAction;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(
    feature = "ts-bridge",
    derive(ts_rs::TS),
    ts(export, export_to = "types/")
)]
pub struct AddCommentRequest {
    pub content: String,
    #[serde(default)]
    pub images: Vec<String>,
}

#[mcp_tool(
    name = "add_comment",
    description = "Add a comment to a discussion. Requires participant role and discussion in progress."
)]
#[post("/api/spaces/{space_id}/discussions/{discussion_sk}/comments", role: SpaceUserRole, member: SpaceUser, space: SpaceCommon, user: crate::features::auth::User )]
pub async fn add_comment(
    #[mcp(description = "Space partition key")] space_id: SpacePartition,
    #[mcp(description = "Discussion sort key (e.g. 'SpacePost#<uuid>')")]
    discussion_sk: SpacePostEntityType,
    #[mcp(description = "Comment content as JSON: {\"content\": \"text\"}")] req: AddCommentRequest,
) -> Result<DiscussionCommentResponse> {
    SpacePost::can_view(&role)?;
    let common_config = crate::common::CommonConfig::default();
    let cli = common_config.dynamodb();
    let space_action = SpaceAction::get_one(&space_id, &discussion_sk.0)
        .await?
        .ok_or(Error::SpaceActionNotFound)?;

    let deps_met = crate::features::spaces::pages::actions::services::dependency::dependencies_met(
        &space,
        &space_action,
        &member.pk,
    )
    .await?;

    let req_attrs_met = crate::features::spaces::pages::actions::services::required_attributes::required_attributes_met(
        &space,
        &space_action,
        &member.pk,
    )
    .await?;

    if !crate::features::spaces::pages::actions::can_execute_space_action(
        role,
        space_action.prerequisite,
        space.status,
        space_action.status.as_ref(),
        deps_met,
        req_attrs_met,
        space.join_anytime,
    ) {
        return Err(SpaceActionDiscussionError::NotAvailableInCurrentStatus.into());
    }

    let space_post_id = SpacePostPartition(discussion_sk.0.clone());
    let post = SpacePost::get_one(&space_id, &space_post_id)
        .await?
        .ok_or(SpaceActionDiscussionError::NotFound)?;

    // Moderation (App Store req #5): a soft-banned author cannot post.
    if crate::common::models::moderation::is_user_soft_banned(&user.pk()).await {
        return Err(Error::NoPermission);
    }

    let comment = SpacePost::comment(
        space_id.clone(),
        space_post_id,
        req.content,
        req.images,
        &member,
    )
    .await?;

    // Emit outbox event (Phase 5) — AiModeratorReplyIndex / DiscussionXpRecord /
    // EssenceIndexDiscussionComment rules on SPACE_POST_COMMENT# INSERT.
    crate::common::events::outbox::EventOutbox::emit_insert(
        crate::common::events::outbox::topic::SPACE_POST_COMMENT,
        &comment,
    )
    .await
    .ok();

    let space_pk: Partition = space_id.clone().into();

    // Essence indexing happens via the DynamoDB Stream pipeline.
    let _ =
        crate::features::spaces::space_common::models::aggregate::DashboardAggregate::inc_comments(
            &space_pk, 1,
        )
        .await;

    crate::features::spaces::space_common::services::bump_participant_activity(
        cli, &space_pk, &member.pk,
    )
    .await;

    // Reward payout + XP recording run on EventBridge via SPACE_POST_COMMENT#
    // INSERT → handle_discussion_xp. Only the user's first contribution in a
    // discussion is rewarded (enforced by RewardPeriod::Once in the award helper).

    // Send mention notifications — deep-link to the newly created comment.
    // `Route::SpaceDiscussionCommentPage` matches `/spaces/:sid/discussions/:did/comments/:cid`
    // and `DiscussionArenaPage` scrolls + highlights the target comment on
    // mount. Comment id is in the path (not query/fragment) because Dioxus
    // Router strips both query strings and fragments during URL
    // normalization on hydration.
    {
        let comment_id_str = comment.comment_id.clone();
        let cta_url = format!(
            "{}/spaces/{}/discussions/{}/comments/{}",
            crate::common::config::site_base_url(),
            space_id,
            discussion_sk,
            comment_id_str,
        );

        crate::common::utils::mention::create_mention_notifications(
            &comment.content,
            &member.pk,
            &member.display_name,
            &cta_url,
        )
        .await;
    }

    // Fan out to discussion subscribers. Recipient resolution (one notification
    // per recipient per comment; mention > reply-target > subscriber) runs off
    // the DynamoDB stream — we only enqueue one notification row here.
    {
        let comment_id_str = comment.comment_id.clone();
        let cta_url = format!(
            "{}/spaces/{}/discussions/{}/comments/{}",
            crate::common::config::site_base_url(),
            space_id,
            discussion_sk,
            comment_id_str,
        );
        let notification = crate::common::models::notification::Notification::new(
            crate::common::types::NotificationData::DiscussionCommentPosted {
                space_id: space_id.clone(),
                discussion_id: discussion_sk.to_string(),
                discussion_title: post.title.clone(),
                comment_sk: comment.comment_entity().to_string(),
                parent_comment_sk: None,
                commenter_pk: member.pk.to_string(),
                commenter_name: member.display_name.clone(),
                comment_content: comment.content.clone(),
                cta_url,
            },
        );
        if let Err(e) = notification.create().await {
            tracing::error!("Failed to enqueue discussion comment notification: {e}");
        }
    }

    Ok(comment.into())
}
