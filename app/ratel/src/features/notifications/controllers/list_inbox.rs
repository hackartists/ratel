use crate::common::*;
use crate::common::models::notification::UserInboxNotification;
use crate::features::auth::User;
use crate::features::notifications::types::{InboxNotificationResponse, NotificationsError};

/// Target number of items to accumulate per response when `space_id`
/// filtering is active, and the hard cap on how many raw Postgres pages we
/// scan to reach it (so a user whose space-related notifications are sparse
/// among many global ones doesn't trigger an unbounded scan).
const SPACE_PAGE_TARGET: usize = 30;
const SPACE_MAX_PAGES: i64 = 5;
const PAGE_SIZE: i64 = 30;

#[mcp_tool(
    name = "list_inbox",
    description = "List current user's notification inbox. Returns paginated results ordered newest-first."
)]
#[get("/api/inbox?unread_only&space_id&bookmark", user: User)]
pub async fn list_inbox_handler(
    #[mcp(description = "If true, return only unread notifications.")] unread_only: Option<bool>,
    #[mcp(
        description = "If set, return only notifications belonging to this space (id without the SPACE# prefix)."
    )]
    space_id: Option<SpacePartition>,
    #[mcp(description = "Opaque pagination bookmark from a previous response. Omit for first page.")]
    bookmark: Option<String>,
) -> Result<ListResponse<InboxNotificationResponse>> {
    let user_id = user.id.to_string();
    let unread = unread_only.unwrap_or(false);
    // `bookmark` carries the next 1-based page number as an opaque string —
    // the client treats it as an opaque cursor, so this is a transparent
    // swap of the DynamoDB cursor for a Postgres page number.
    let start_page: i64 = bookmark
        .as_deref()
        .and_then(|b| b.parse().ok())
        .filter(|p| *p >= 1)
        .unwrap_or(1);

    // Unfiltered path: preserve the original single-page behavior exactly.
    if space_id.is_none() {
        let page_result = fetch_inbox_page(&user_id, unread, start_page).await?;
        let next_bookmark = if start_page < page_result.total_pages {
            Some((start_page + 1).to_string())
        } else {
            None
        };
        let items: Vec<InboxNotificationResponse> =
            page_result.items.into_iter().map(Into::into).collect();
        return Ok((items, next_bookmark).into());
    }

    // Space-scoped path: notifications carry their space only inside the
    // payload, so we filter post-fetch. A single raw page may yield few (or
    // zero) matches, so keep paging until we've collected enough or run out —
    // capped at SPACE_MAX_PAGES. The returned bookmark is the next raw page
    // number, letting the client's infinite query resume.
    let space_id = space_id.unwrap();
    let mut acc: Vec<InboxNotificationResponse> = Vec::new();
    let mut page = start_page;
    let mut next_out: Option<String> = None;

    for _ in 0..SPACE_MAX_PAGES {
        let page_result = fetch_inbox_page(&user_id, unread, page).await?;
        for it in page_result.items {
            let resp: InboxNotificationResponse = it.into();
            if resp.payload.space_id().as_ref() == Some(&space_id) {
                acc.push(resp);
            }
        }
        if page < page_result.total_pages {
            page += 1;
            next_out = Some(page.to_string());
        } else {
            next_out = None;
            break;
        }
        if acc.len() >= SPACE_PAGE_TARGET {
            break;
        }
    }

    Ok((acc, next_out).into())
}

/// Fetch one raw page of the user's inbox newest-first. `unread` selects
/// `is_read = false` rows.
#[cfg(feature = "server")]
async fn fetch_inbox_page(
    user_id: &str,
    unread: bool,
    page: i64,
) -> Result<postgres::Page<UserInboxNotification>> {
    UserInboxNotification::find_for_user(user_id, unread, page, PAGE_SIZE)
        .await
        .map_err(|e| {
            crate::error!("list_inbox query failed: {e}");
            NotificationsError::ListFailed.into()
        })
}
