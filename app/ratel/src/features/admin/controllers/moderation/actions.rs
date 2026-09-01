use crate::common::models::auth::AdminUser;
use crate::common::models::moderation::{ModerationStatus, UserModerationFlag};
use crate::features::admin::*;
use crate::features::spaces::pages::actions::actions::discussion::{
    SpacePostComment, SpacePostCommentReport,
};
#[cfg(feature = "server")]
use postgres::PostgresEntity;

/// Hide (or restore) every comment that has been reported against `author_pk`.
#[cfg(feature = "server")]
async fn set_reported_comments_hidden(author_pk: &Partition, hidden: bool) {
    let reports = match SpacePostCommentReport::list_by_author(author_pk, None, 500).await {
        Ok((items, _)) => items,
        Err(e) => {
            crate::error!("moderation: failed to list reports for author: {e}");
            return;
        }
    };

    // One report row per (comment, reporter) — collapse to distinct comments so
    // a comment reported by five users is updated once, not five times.
    let mut seen = std::collections::HashSet::new();
    for r in reports {
        if !seen.insert((r.post_id.clone(), r.comment_key.clone())) {
            continue;
        }
        // `comment_key` is the leaf id for a top-level comment and
        // `{parent}#{reply}` for a reply — the leaf is the last segment.
        let leaf = r
            .comment_key
            .rsplit('#')
            .next()
            .unwrap_or(&r.comment_key)
            .to_string();
        match SpacePostComment::get_by_leaf(&r.post_id, &leaf).await {
            Ok(Some(c)) => {
                if let Err(e) = SpacePostComment::repository()
                    .update(c.id, SpacePostComment::update().hidden(hidden))
                    .await
                {
                    crate::error!("moderation: failed to set comment hidden={hidden}: {e}");
                }
            }
            Ok(None) => {}
            Err(e) => crate::error!("moderation: failed to load reported comment: {e}"),
        }
    }
}

/// Admin soft-ban (App Store req #5): mark the user `Blocked` (posting rejected)
/// and hide all of their reported comments.
#[post("/api/admin/moderation/users/{user_id}/block", _user: AdminUser)]
pub async fn admin_block_user(user_id: String) -> Result<()> {
    let user_pk = Partition::User(user_id);
    UserModerationFlag::set_status(&user_pk, ModerationStatus::Blocked).await?;
    set_reported_comments_hidden(&user_pk, true).await;
    Ok(())
}

/// Admin dismissal: clear the flag and restore the auto-hidden comments.
#[post("/api/admin/moderation/users/{user_id}/dismiss", _user: AdminUser)]
pub async fn admin_dismiss_user(user_id: String) -> Result<()> {
    let user_pk = Partition::User(user_id);
    UserModerationFlag::set_status(&user_pk, ModerationStatus::Dismissed).await?;
    set_reported_comments_hidden(&user_pk, false).await;
    Ok(())
}
