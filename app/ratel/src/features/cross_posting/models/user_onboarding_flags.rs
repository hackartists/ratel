use crate::common::*;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;
use uuid::Uuid;

#[cfg(feature = "server")]
use postgres::PostgresEntity;

/// Singleton sidecar per user, tracking onboarding interstitials the user
/// has dismissed. Kept **off** the main `User` entity for feature-flag
/// isolation. Default when the row is absent is `false` for every flag.
///
/// Postgres migration: surrogate `id` PK; the DynamoDB `(User(user_id),
/// UserOnboardingFlags)` singleton identity becomes `unique(user_id)`.
/// `user_id` is a cross-feature reference (auth) — plain String, **no** FK.
///
/// Design doc: docs/superpowers/specs/2026-04-28-cross-posting-design.md
/// (`UserOnboardingFlags` section). FR-2 #13.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(PostgresEntity))]
#[cfg_attr(
    feature = "server",
    postgres(table = "user_onboarding_flags", unique(user_id))
)]
pub struct UserOnboardingFlags {
    pub id: Uuid,

    /// Cross-feature reference to the auth `User` (bare user id).
    #[cfg_attr(feature = "server", postgres(index))]
    pub user_id: String,

    /// Set true on Continue / Skip from the post-signup interstitial.
    pub cross_posting_interstitial_seen: bool,

    pub created_at: i64,
    pub updated_at: i64,
}

#[cfg(feature = "server")]
impl UserOnboardingFlags {
    /// The singleton onboarding-flags row for a user, if any.
    pub async fn find_by_user(user_id: &str) -> postgres::Result<Option<Self>> {
        use postgres::ops::StringOp;
        Self::repository()
            .find_one(Self::query().user_id(StringOp::Eq(user_id.to_string())))
            .await
    }
}
