use crate::common::*;
use crate::features::auth::User;
use crate::features::cross_posting::models::SocialConnection;
use crate::features::cross_posting::types::{ConnectionResponse, CrossPostingError};
#[cfg(feature = "server")]
use crate::features::cross_posting::services::user_id_of;

/// Lists every `SocialConnection` row for the authenticated user.
/// Includes Connected, AuthExpired, and Revoked rows alike — the UI
/// renders Revoked rows as "Not connected" (the row is kept so we can
/// resolve historical handles for past `SyndicationJob` references).
#[get("/api/cross-posting/connections", user: User)]
pub async fn list_connections_handler() -> Result<Vec<ConnectionResponse>> {
    let user_id = user_id_of(&user.pk);

    // At most 3 rows per user (Bluesky / LinkedIn / Threads), so no pagination.
    let rows = SocialConnection::find_by_user(&user_id).await.map_err(|e| {
        crate::error!("list_connections query failed: {e}");
        CrossPostingError::ListFailed
    })?;

    Ok(rows.into_iter().map(Into::into).collect())
}
