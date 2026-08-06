use crate::common::*;
use crate::features::auth::User;
use crate::features::cross_posting::models::{
    ConnectionStatus, CredentialCiphertext, SocialConnection,
};
use crate::features::cross_posting::types::{CrossPostingError, SocialPlatform};
#[cfg(feature = "server")]
use crate::features::cross_posting::services::user_id_of;
#[cfg(feature = "server")]
use postgres::PostgresEntity;

/// Soft-delete: zero the credential ciphertext, mark Revoked. The row is
/// kept (not hard-deleted) so historical "posted via …" rendering on past
/// `SyndicationJob` references can still resolve the platform handle.
/// Future cross-posts to this platform stop because Stage 1's
/// `enabled_platforms ∩ connected` check filters out non-Connected rows.
#[delete("/api/cross-posting/connections/{platform}", user: User)]
pub async fn disconnect_handler(platform: SocialPlatform) -> Result<()> {
    let user_id = user_id_of(&user.pk);
    let now = crate::common::utils::time::now();

    // Load to confirm existence; idempotent — second DELETE on an
    // already-revoked row is a no-op success.
    let existing = SocialConnection::find_by_user_platform(&user_id, platform)
        .await
        .map_err(|e| {
            crate::error!("disconnect lookup failed: {e}");
            CrossPostingError::UpdateFailed
        })?;

    let Some(existing) = existing else {
        return Ok(());
    };

    SocialConnection::repository()
        .update(
            existing.id,
            SocialConnection::update()
                .status(ConnectionStatus::Revoked)
                .credential_ciphertext(CredentialCiphertext(Vec::new()))
                .platform_status(SocialConnection::platform_status_key(
                    platform,
                    ConnectionStatus::Revoked,
                ))
                .updated_at(now),
        )
        .await
        .map_err(|e| {
            crate::error!("disconnect update failed: {e}");
            CrossPostingError::UpdateFailed
        })?;

    Ok(())
}
