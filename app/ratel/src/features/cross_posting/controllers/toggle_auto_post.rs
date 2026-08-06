use crate::common::*;
use crate::features::auth::User;
use crate::features::cross_posting::models::SocialConnection;
use crate::features::cross_posting::types::{
    ConnectionResponse, CrossPostingError, SocialPlatform, ToggleAutoPostRequest,
};
#[cfg(feature = "server")]
use crate::features::cross_posting::services::user_id_of;
#[cfg(feature = "server")]
use postgres::PostgresEntity;

#[patch("/api/cross-posting/connections/{platform}", user: User)]
pub async fn toggle_auto_post_handler(
    platform: SocialPlatform,
    req: ToggleAutoPostRequest,
) -> Result<ConnectionResponse> {
    let user_id = user_id_of(&user.pk());
    let now = crate::common::utils::time::now();

    let existing = SocialConnection::find_by_user_platform(&user_id, platform)
        .await
        .map_err(|e| {
            crate::error!("toggle_auto_post lookup failed: {e}");
            CrossPostingError::UpdateFailed
        })?
        .ok_or(CrossPostingError::ConnectionNotFound)?;

    let updated = SocialConnection::repository()
        .update(
            existing.id,
            SocialConnection::update()
                .auto_post_enabled(req.auto_post_enabled)
                .updated_at(now),
        )
        .await
        .map_err(|e| {
            crate::error!("toggle_auto_post update failed: {e}");
            CrossPostingError::UpdateFailed
        })?;

    Ok(updated.into())
}
