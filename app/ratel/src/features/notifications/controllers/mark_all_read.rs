use crate::common::*;
#[cfg(feature = "server")]
use crate::common::models::notification::UserInboxNotification;
use crate::features::auth::User;
use crate::features::notifications::types::{MarkAllReadResponse, NotificationsError};

const MAX_PAGES: i64 = 5;
const PAGE_SIZE: i64 = 30;

#[post("/api/inbox/read-all?space_id", user: User)]
pub async fn mark_all_read_handler(
    space_id: Option<SpacePartition>,
) -> Result<MarkAllReadResponse> {
    let user_id = user.id.to_string();

    let mut affected = 0i64;
    let mut has_more = false;

    for page in 1..=MAX_PAGES {
        let page_result = UserInboxNotification::find_for_user(&user_id, true, page, PAGE_SIZE)
            .await
            .map_err(|e| {
                crate::error!("read-all query failed: {e}");
                NotificationsError::MarkReadFailed
            })?;

        for item in &page_result.items {
            // When scoping to a space, skip notifications that don't belong
            // to it — they stay unread in the global inbox.
            if let Some(sid) = &space_id {
                if item.payload.space_id().as_ref() != Some(sid) {
                    continue;
                }
            }
            if let Err(e) = item.mark_read().await {
                crate::error!("read-all per-row update failed: {e}");
                continue;
            }
            affected += 1;
        }

        if page >= page_result.total_pages {
            break;
        }
        if page == MAX_PAGES {
            has_more = true;
        }
    }

    Ok(MarkAllReadResponse { affected, has_more })
}
