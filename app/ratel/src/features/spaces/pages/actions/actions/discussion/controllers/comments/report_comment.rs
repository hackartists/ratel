use crate::common::models::moderation::{ModerationSetting, ModerationStatus, UserModerationFlag};
use crate::features::spaces::pages::actions::actions::discussion::*;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;
#[cfg(feature = "server")]
use postgres::PostgresEntity;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub struct ReportCommentRequest {
    pub reason: ReportReason,
    #[serde(default)]
    pub detail: String,
}

/// Report a discussion comment as objectionable (App Store UGC req #3).
///
/// One report per (comment, reporter) — a repeat report by the same user is a
/// no-op. When a comment's DISTINCT reporter count reaches the admin-configured
/// threshold the comment is auto-hidden (req #2); the reported AUTHOR enters the
/// admin moderation queue on their first report (req #5).
#[post("/api/spaces/{space_id}/discussions/{discussion_sk}/comments/{comment_sk}/report", role: SpaceUserRole, user: crate::features::auth::User)]
pub async fn report_comment(
    space_id: SpacePartition,
    discussion_sk: SpacePostEntityType,
    comment_sk: SpacePostCommentTargetEntityType,
    req: ReportCommentRequest,
) -> Result<()> {
    let _ = space_id;
    SpacePost::can_view(&role)?;

    let space_post_pk = SpacePostPartition(discussion_sk.0);
    let post_id = space_post_pk.0.clone();
    let comment_sk_entity: EntityType = comment_sk.into();

    let comment = SpacePostComment::get_by_entity(&space_post_pk, &comment_sk_entity)
        .await?
        .ok_or(SpaceActionDiscussionError::NotFound)?;

    // A user cannot report their own comment.
    if comment.author_pk == user.pk().to_string() {
        return Err(Error::NoPermission);
    }

    let comment_key = comment.like_key();

    // Dedup: if this reporter already reported this comment, no-op.
    if SpacePostCommentReport::already_reported(&post_id, &comment_key, &user.pk()).await? {
        return Ok(());
    }

    let report = SpacePostCommentReport::new(
        post_id.clone(),
        comment_key.clone(),
        comment.author_pk.clone(),
        &user.pk(),
        req.reason,
        req.detail,
    );
    SpacePostCommentReport::repository()
        .insert(&report)
        .await
        .map_err(|e| {
            crate::error!("failed to create comment report: {e}");
            SpaceActionDiscussionError::CreateFailed
        })?;

    // Threshold (admin-configurable, default 3).
    let threshold = ModerationSetting::threshold().await;

    // Recount DISTINCT reporters and auto-hide once the threshold is reached.
    // Counting beats an increment here: the UNIQUE index is the source of
    // truth, so a concurrent double-report can never inflate the tally.
    let count = SpacePostCommentReport::count_for_comment(&post_id, &comment_key)
        .await
        .unwrap_or(comment.report_count + 1);

    let mut upd = SpacePostComment::update().report_count(count);
    if count >= threshold && !comment.hidden {
        upd = upd.hidden(true);
    }
    if let Err(e) = SpacePostComment::repository().update(comment.id, upd).await {
        crate::error!("failed to bump comment report_count: {e}");
    }

    // Bump the author's moderation tally and surface them in the admin queue.
    bump_author_flag(&comment).await;

    Ok(())
}

/// Upsert the reported author's `UserModerationFlag`. A reported user enters the
/// admin review queue (`PendingReview`) on their FIRST report so an admin can
/// review and decide immediately — the report threshold governs the automated
/// comment auto-hide (above), not when the admin sees the user. An existing
/// admin decision (`Blocked` / `Dismissed`) is never overridden.
#[cfg(feature = "server")]
#[cfg(feature = "server")]
async fn bump_author_flag(comment: &SpacePostComment) {
    use crate::common::utils::time::get_now_timestamp;

    let author_pk = comment.author_partition();
    if !matches!(author_pk, Partition::User(_)) {
        return;
    }

    match UserModerationFlag::find_by_user(&author_pk).await {
        Ok(Some(flag)) => {
            let mut upd = UserModerationFlag::update()
                .report_count(flag.report_count + 1)
                .updated_at(get_now_timestamp());
            // Surface an otherwise-untouched user for review. Never override an
            // admin decision (Blocked / Dismissed).
            if flag.status == ModerationStatus::None {
                upd = upd.status(ModerationStatus::PendingReview);
            }
            if let Err(e) = UserModerationFlag::repository().update(flag.id, upd).await {
                crate::error!("failed to bump author moderation flag: {e}");
            }
        }
        Ok(None) => {
            let mut flag = match UserModerationFlag::new(
                &author_pk,
                comment.author_display_name.clone(),
                comment.author_username.clone(),
            ) {
                Some(f) => f,
                None => return,
            };
            flag.report_count = 1;
            flag.status = ModerationStatus::PendingReview;
            if let Err(e) = UserModerationFlag::repository().insert(&flag).await {
                crate::error!("failed to create author moderation flag: {e}");
            }
        }
        Err(e) => {
            crate::error!("failed to load author moderation flag: {e}");
        }
    }
}
