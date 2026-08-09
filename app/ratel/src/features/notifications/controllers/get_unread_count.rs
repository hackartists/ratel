use crate::common::*;
#[cfg(feature = "server")]
use crate::common::models::notification::UserInboxNotification;
use crate::features::auth::User;
use crate::features::notifications::types::{NotificationsError, UnreadCountResponse};

const UNREAD_COUNT_CAP: i64 = 100;
const PAGE_SIZE: i64 = 30;

#[mcp_tool(
    name = "get_unread_count",
    description = "Return the count of unread notifications in the current user's inbox (capped at 100)."
)]
#[get("/api/inbox/unread-count?space_id", user: User)]
pub async fn get_unread_count_handler(
    #[mcp(
        description = "If set, count only unread notifications belonging to this space (id without the SPACE# prefix)."
    )]
    space_id: Option<SpacePartition>,
) -> Result<UnreadCountResponse> {
    let user_id = user.id.to_string();

    // When scoping to a space, notifications carry their space only inside the
    // payload, so scan more pages (capped) and count only matching rows.
    let max_pages: i64 = if space_id.is_some() { 5 } else { 4 };
    let mut count: i64 = 0;

    for page in 1..=max_pages {
        let page_result =
            UserInboxNotification::find_for_user(&user_id, true, page, PAGE_SIZE)
                .await
                .map_err(|e| {
                    crate::error!("unread-count query failed: {e}");
                    NotificationsError::ListFailed
                })?;
        count += match &space_id {
            Some(sid) => page_result
                .items
                .iter()
                .filter(|it| it.payload.space_id().as_ref() == Some(sid))
                .count() as i64,
            None => page_result.items.len() as i64,
        };
        if count >= UNREAD_COUNT_CAP {
            return Ok(UnreadCountResponse {
                count: UNREAD_COUNT_CAP,
            });
        }
        if page >= page_result.total_pages {
            break;
        }
    }
    Ok(UnreadCountResponse { count })
}
