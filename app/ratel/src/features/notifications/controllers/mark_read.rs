use crate::common::*;
use crate::common::models::notification::UserInboxNotification;
use crate::features::auth::User;
use crate::features::notifications::types::NotificationsError;

#[post("/api/inbox/{inbox_id}/read", user: User)]
pub async fn mark_read_handler(inbox_id: UserInboxNotificationEntityType) -> Result<()> {
    let user_id = user.id.to_string();

    let id = uuid::Uuid::parse_str(&inbox_id.0)
        .map_err(|_| NotificationsError::InboxEntryNotFound)?;

    let existing = UserInboxNotification::get_owned(&user_id, id)
        .await
        .map_err(|e| {
            crate::error!("mark_read get failed: {e}");
            NotificationsError::MarkReadFailed
        })?
        .ok_or(NotificationsError::InboxEntryNotFound)?;

    // `mark_read` is itself a no-op if the row is already read.
    existing.mark_read().await.map_err(|e| {
        crate::error!("mark_read update failed: {e}");
        NotificationsError::MarkReadFailed
    })?;

    Ok(())
}
