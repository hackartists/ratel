use crate::common::*;
use crate::common::models::notification::UserDeviceToken;
use crate::features::auth::User;
use crate::features::notifications::types::NotificationsError;

/// Remove a device's push token (call on logout / token invalidation). The
/// `device_id` path param is a `SubPartition` so the client sends the bare id.
#[delete("/api/devices/{device_id}", user: User)]
pub async fn unregister_device_handler(device_id: UserDeviceTokenEntityType) -> Result<()> {
    let user_id = user.id.to_string();

    UserDeviceToken::delete_for(&user_id, &device_id.0)
        .await
        .map_err(|e| {
            crate::error!("unregister_device failed: {e}");
            NotificationsError::DeviceUnregisterFailed
        })?;

    Ok(())
}
