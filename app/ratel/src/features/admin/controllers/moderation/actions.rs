use crate::common::models::auth::AdminUser;
use crate::common::models::moderation::{ModerationStatus, UserModerationFlag};
use crate::common::utils::time::get_now_timestamp;
use crate::features::admin::*;
use crate::features::spaces::pages::actions::actions::discussion::{
    SpacePostComment, SpacePostCommentReport,
};

/// Hide (or restore) every comment that has been reported against `author_pk`.
#[cfg(feature = "server")]
async fn set_reported_comments_hidden(
    cli: &aws_sdk_dynamodb::Client,
    author_pk: &Partition,
    hidden: bool,
) {
    let opt = SpacePostCommentReport::opt().limit(500);
    match SpacePostCommentReport::find_by_author(cli, author_pk, opt).await {
        Ok((reports, _)) => {
            for r in reports {
                if let Err(e) = SpacePostComment::updater(&r.pk, &r.comment_sk)
                    .with_hidden(hidden)
                    .execute(cli)
                    .await
                {
                    crate::error!("moderation: failed to set comment hidden={hidden}: {e}");
                }
            }
        }
        Err(e) => crate::error!("moderation: failed to list reports for author: {e}"),
    }
}

#[cfg(feature = "server")]
async fn set_flag_status(
    cli: &aws_sdk_dynamodb::Client,
    user_pk: &Partition,
    status: ModerationStatus,
) -> Result<()> {
    let (pk, sk) = UserModerationFlag::keys(user_pk).ok_or(Error::NoPermission)?;
    match UserModerationFlag::get(cli, &pk, Some(sk.clone())).await? {
        Some(_) => {
            UserModerationFlag::updater(&pk, &sk)
                .with_status(status)
                .with_updated_at(get_now_timestamp())
                .execute(cli)
                .await?;
        }
        None => {
            let mut flag = UserModerationFlag::new(user_pk.clone(), String::new(), String::new())
                .ok_or(Error::NoPermission)?;
            flag.status = status;
            flag.create(cli).await?;
        }
    }
    Ok(())
}

/// Admin soft-ban (App Store req #5): mark the user `Blocked` (posting rejected)
/// and hide all of their reported comments.
#[post("/api/admin/moderation/users/{user_id}/block", _user: AdminUser)]
pub async fn admin_block_user(user_id: String) -> Result<()> {
    let common_config = crate::common::CommonConfig::default();
    let cli = common_config.dynamodb();

    let user_pk = Partition::User(user_id);
    set_flag_status(cli, &user_pk, ModerationStatus::Blocked).await?;
    set_reported_comments_hidden(cli, &user_pk, true).await;
    Ok(())
}

/// Admin dismissal: clear the flag and restore the auto-hidden comments.
#[post("/api/admin/moderation/users/{user_id}/dismiss", _user: AdminUser)]
pub async fn admin_dismiss_user(user_id: String) -> Result<()> {
    let common_config = crate::common::CommonConfig::default();
    let cli = common_config.dynamodb();

    let user_pk = Partition::User(user_id);
    set_flag_status(cli, &user_pk, ModerationStatus::Dismissed).await?;
    set_reported_comments_hidden(cli, &user_pk, false).await;
    Ok(())
}
