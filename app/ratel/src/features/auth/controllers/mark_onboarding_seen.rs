use crate::features::auth::*;
#[cfg(feature = "server")]
use postgres::PostgresEntity;

/// Mark the cross-posting onboarding interstitial as seen for the current user.
///
/// Called by the OnboardingConnections page on Continue / Skip / connection-success
/// (FR-2 #13). Idempotent — flipping `interstitial_seen` from `true` to `true`
/// is a no-op write but doesn't error. Returns the updated `User` so the
/// caller can refresh `UserContext` without a separate `get_me` round-trip.
#[post("/api/auth/onboarding-seen", user: User)]
pub async fn mark_onboarding_seen_handler() -> Result<User> {
    // `update()` returns the row post-write, so no separate re-read is needed.
    let updated = User::repository()
        .update(user.id, User::update().interstitial_seen(true))
        .await?;
    Ok(updated)
}
