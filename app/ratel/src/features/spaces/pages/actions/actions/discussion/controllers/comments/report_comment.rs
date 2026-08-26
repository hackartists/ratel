use crate::common::models::moderation::{
    ModerationSetting, ModerationStatus, UserModerationFlag,
};
use crate::features::spaces::pages::actions::actions::discussion::*;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportCommentRequest {
    pub reason: ReportReason,
    #[serde(default)]
    pub detail: String,
}

/// Report a discussion comment as objectionable (App Store UGC req #3).
///
/// One report per (comment, reporter) — a repeat report by the same user is a
/// no-op. When a comment's DISTINCT reporter count reaches the admin-configured
/// threshold the comment is auto-hidden (req #2); when the reported AUTHOR's
/// accumulated report count reaches the threshold the author is flagged
/// `PendingReview` for the admin moderation queue (req #5).
#[post("/api/spaces/{space_id}/discussions/{discussion_sk}/comments/{comment_sk}/report", role: SpaceUserRole, user: crate::features::auth::User)]
pub async fn report_comment(
    space_id: SpacePartition,
    discussion_sk: SpacePostEntityType,
    comment_sk: SpacePostCommentTargetEntityType,
    req: ReportCommentRequest,
) -> Result<()> {
    SpacePost::can_view(&role)?;
    let common_config = crate::common::CommonConfig::default();
    let cli = common_config.dynamodb();

    let discussion_sk_entity: EntityType = discussion_sk.into();
    let space_post_pk: SpacePostPartition = match &discussion_sk_entity {
        EntityType::SpacePost(id) => SpacePostPartition(id.clone()),
        _ => return Err(SpaceActionDiscussionError::InvalidDiscussionId.into()),
    };
    let post_pk: Partition = space_post_pk.into();
    let comment_sk_entity: EntityType = comment_sk.into();

    let comment = SpacePostComment::get(cli, &post_pk, Some(comment_sk_entity.clone()))
        .await?
        .ok_or(SpaceActionDiscussionError::NotFound)?;

    // A user cannot report their own comment.
    if comment.author_pk == user.pk {
        return Err(Error::NoPermission);
    }

    // Dedup: if this reporter already reported this comment, no-op.
    let (report_pk, report_sk) =
        match SpacePostCommentReport::keys(&post_pk, &comment_sk_entity, &user.pk) {
            Some(keys) => keys,
            None => return Err(SpaceActionDiscussionError::InvalidDiscussionId.into()),
        };
    if SpacePostCommentReport::get(cli, &report_pk, Some(report_sk))
        .await?
        .is_some()
    {
        return Ok(());
    }

    let report = SpacePostCommentReport::new(
        post_pk.clone(),
        comment_sk_entity.clone(),
        comment.author_pk.clone(),
        user.pk.clone(),
        req.reason,
        req.detail,
    )
    .ok_or(SpaceActionDiscussionError::InvalidDiscussionId)?;

    report.create(cli).await.map_err(|e| {
        crate::error!("failed to create comment report: {e}");
        SpaceActionDiscussionError::CreateFailed
    })?;

    // Threshold (admin-configurable, default 3).
    let (setting_pk, setting_sk) = ModerationSetting::keys();
    let threshold = ModerationSetting::get(cli, &setting_pk, Some(setting_sk))
        .await
        .ok()
        .flatten()
        .map(|s| s.report_threshold)
        .unwrap_or(crate::common::models::moderation::DEFAULT_REPORT_THRESHOLD)
        .max(1);

    // Bump the comment's reporter count; auto-hide once it hits the threshold.
    let new_comment_count = comment.report_count + 1;
    let mut comment_updater =
        SpacePostComment::updater(&post_pk, &comment_sk_entity).increase_report_count(1);
    if new_comment_count >= threshold && !comment.hidden {
        comment_updater = comment_updater.with_hidden(true);
    }
    if let Err(e) = comment_updater.execute(cli).await {
        crate::error!("failed to bump comment report_count: {e}");
    }

    // Bump the author's moderation tally and surface them in the admin queue.
    bump_author_flag(cli, &comment).await;

    Ok(())
}

/// Upsert the reported author's `UserModerationFlag`. A reported user enters the
/// admin review queue (`PendingReview`) on their FIRST report so an admin can
/// review and decide immediately — the report threshold governs the automated
/// comment auto-hide (above), not when the admin sees the user. An existing
/// admin decision (`Blocked` / `Dismissed`) is never overridden.
#[cfg(feature = "server")]
async fn bump_author_flag(cli: &aws_sdk_dynamodb::Client, comment: &SpacePostComment) {
    use crate::common::utils::time::get_now_timestamp;

    let (flag_pk, flag_sk) = match UserModerationFlag::keys(&comment.author_pk) {
        Some(keys) => keys,
        None => return,
    };

    match UserModerationFlag::get(cli, &flag_pk, Some(flag_sk)).await {
        Ok(Some(flag)) => {
            let mut updater = UserModerationFlag::updater(&flag.pk, &flag.sk)
                .increase_report_count(1)
                .with_updated_at(get_now_timestamp());
            // Surface an otherwise-untouched user for review. Never override an
            // admin decision (Blocked / Dismissed).
            if flag.status == ModerationStatus::None {
                updater = updater.with_status(ModerationStatus::PendingReview);
            }
            if let Err(e) = updater.execute(cli).await {
                crate::error!("failed to bump author moderation flag: {e}");
            }
        }
        Ok(None) => {
            let mut flag = match UserModerationFlag::new(
                comment.author_pk.clone(),
                comment.author_display_name.clone(),
                comment.author_username.clone(),
            ) {
                Some(f) => f,
                None => return,
            };
            flag.report_count = 1;
            flag.status = ModerationStatus::PendingReview;
            if let Err(e) = flag.create(cli).await {
                crate::error!("failed to create author moderation flag: {e}");
            }
        }
        Err(e) => {
            crate::error!("failed to load author moderation flag: {e}");
        }
    }
}
