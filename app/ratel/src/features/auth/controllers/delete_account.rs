use crate::features::auth::*;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;
#[cfg(feature = "server")]
use postgres::PostgresEntity;

#[cfg(feature = "server")]
const DEFAULT_PROFILE_URL: &str = "https://metadata.ratel.foundation/ratel/default-profile.png";
#[cfg(feature = "server")]
const ANON_AUTHOR_NAME: &str = "Deleted User";
#[cfg(feature = "server")]
const ANON_AUTHOR_USERNAME: &str = "deleted";
/// Safety cap on author-snapshot anonymization pages so a user with an
/// unbounded post/comment history can't make the delete request run forever.
#[cfg(feature = "server")]
const MAX_ANON_PAGES: usize = 40;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct DeleteAccountResponse {
    pub status: String,
}

/// Soft-delete the current user's account. Irreversible from the user's side.
///
/// - Stamps `deleted_at` and anonymizes `email`/`username`/`display_name`/
///   `profile_url` so the original email & username are freed for re-signup and
///   the tombstoned row can never be found by the original identifiers.
/// - Removes auth-linkage rows (EVM / OAuth / phone / principal / telegram) so
///   the account can't be resurrected via any login method.
/// - Anonymizes the author snapshot on the user's posts and comments (content
///   stays in context; the deleted identity is hidden).
/// - Flushes the current session.
#[post("/api/auth/account/delete", user: User, session: Extension<tower_sessions::Session>)]
pub async fn delete_account_handler() -> Result<DeleteAccountResponse> {
    let Extension(session) = session;

    let uid = user.id();
    let user_pk = user.pk();
    let now = crate::common::utils::time::now();

    // 1) Soft-delete + anonymize the user row. Updating `email`/`username`
    //    rewrites their indexed columns, so the original values stop
    //    resolving and become available for a fresh signup.
    User::repository()
        .update(
            user.id,
            User::update()
                .deleted_at(now)
                .email(format!("deleted+{uid}@deleted.ratel"))
                .username(format!("deleted_{uid}"))
                .display_name(ANON_AUTHOR_NAME.to_string())
                .profile_url(DEFAULT_PROFILE_URL.to_string())
                .updated_at(now),
        )
        .await
        .map_err(|e| {
            crate::error!("delete_account: anonymize user {uid} failed: {e}");
            AuthError::AccountDeletionFailed
        })?;

    // 2) Remove auth-linkage rows so re-auth via any method can't resurrect the
    //    account. Best-effort: a missing row is fine, and a failure here must
    //    not leave the user half-deleted (the row above is already tombstoned).
    let _ = UserEvmAddress::delete_for_user(&user_pk).await;
    let _ = UserOAuth::delete_for_user(&user_pk).await;
    let _ = UserPhoneNumber::delete_for_user(&user_pk).await;
    let _ = UserPrincipal::delete_for_user(&user_pk).await;
    let _ = UserTelegram::delete_for_user(&user_pk).await;

    // 3) Anonymize author snapshots on the user's posts & comments (content
    //    preserved, identity hidden). Best-effort — never fails the deletion.
    anonymize_user_posts(&user_pk).await;
    anonymize_user_comments(&user_pk).await;

    // 4) Flush the current session.
    let _ = session.flush().await;

    Ok(DeleteAccountResponse {
        status: "OK".to_string(),
    })
}

#[cfg(feature = "server")]
async fn anonymize_user_posts(user_pk: &Partition) {
    use crate::features::posts::models::{Post, PostColumn};
    use postgres::Order;
    use postgres::ops::StringOp;

    let page_size: i64 = 50;
    let mut page: i64 = 1;
    for _ in 0..MAX_ANON_PAGES {
        let page_data = match Post::repository()
            .find(
                Post::query()
                    .user_pk(StringOp::Eq(user_pk.to_string()))
                    .order_by(PostColumn::CreatedAt, Order::Desc)
                    .page(page)
                    .page_size(page_size),
            )
            .await
        {
            Ok(v) => v,
            Err(e) => {
                crate::error!("delete_account: list posts failed: {e}");
                return;
            }
        };

        for p in &page_data.items {
            if let Err(e) = Post::repository()
                .update(
                    p.id,
                    Post::update()
                        .author_display_name(ANON_AUTHOR_NAME.to_string())
                        .author_username(ANON_AUTHOR_USERNAME.to_string())
                        .author_profile_url(DEFAULT_PROFILE_URL.to_string()),
                )
                .await
            {
                crate::error!("delete_account: anonymize post {:?} failed: {e}", p.id);
            }
        }

        if page >= page_data.total_pages {
            return;
        }
        page += 1;
    }
}

#[cfg(feature = "server")]
async fn anonymize_user_comments(user_pk: &Partition) {
    use crate::features::posts::models::{PostComment, PostCommentColumn};
    use postgres::Order;
    use postgres::ops::StringOp;

    let page_size: i64 = 50;
    let mut page: i64 = 1;
    for _ in 0..MAX_ANON_PAGES {
        let page_data = match PostComment::repository()
            .find(
                PostComment::query()
                    .author_pk(StringOp::Eq(user_pk.to_string()))
                    .order_by(PostCommentColumn::CreatedAt, Order::Desc)
                    .page(page)
                    .page_size(page_size),
            )
            .await
        {
            Ok(v) => v,
            Err(e) => {
                crate::error!("delete_account: list comments failed: {e}");
                return;
            }
        };

        for c in &page_data.items {
            if let Err(e) = PostComment::repository()
                .update(
                    c.id,
                    PostComment::update()
                        .author_display_name(ANON_AUTHOR_NAME.to_string())
                        .author_username(ANON_AUTHOR_USERNAME.to_string())
                        .author_profile_url(DEFAULT_PROFILE_URL.to_string()),
                )
                .await
            {
                crate::error!("delete_account: anonymize comment {:?} failed: {e}", c.id);
            }
        }

        if page >= page_data.total_pages {
            return;
        }
        page += 1;
    }
}
