use crate::features::spaces::pages::apps::apps::analyzes::*;
use uuid::Uuid;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[cfg(feature = "server")]
use postgres::PostgresEntity;

/// Singleton row controlling the analyze-report creation quota for
/// non-enterprise tiers. Postgres migration: surrogate `id` PK plus a
/// fixed `config_key` ("global") natural key so the single deployment-wide
/// row is upsert-addressable.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[cfg_attr(
    feature = "server",
    derive(PostgresEntity)
)]
#[cfg_attr(feature = "server", postgres(table = "analyze_quota_configs"))]
pub struct AnalyzeQuotaConfig {
    pub id: Uuid,

    #[cfg_attr(feature = "server", postgres(unique))]
    #[serde(default)]
    pub config_key: String,

    pub created_at: i64,
    pub updated_at: i64,

    /// Maximum analyze reports a non-enterprise user may have in a
    /// single space. Enterprise membership is unlimited.
    #[serde(default)]
    pub non_enterprise_limit: i64,
}

#[cfg(feature = "server")]
impl AnalyzeQuotaConfig {
    /// Hardcoded fallback used when the row hasn't been initialised yet.
    pub const DEFAULT_LIMIT: i64 = 2;

    /// The deployment-wide singleton key.
    pub const GLOBAL_KEY: &'static str = "global";

    /// Loads the configured limit, falling back to `DEFAULT_LIMIT` when no
    /// row exists yet. Errors propagate so callers can decide whether to
    /// fail closed or open.
    pub async fn get_limit() -> crate::common::Result<i64> {
        use postgres::ops::StringOp;
        let row = Self::repository()
            .find_one(Self::query().config_key(StringOp::Eq(Self::GLOBAL_KEY.to_string())))
            .await?;
        Ok(row
            .map(|r| r.non_enterprise_limit)
            .unwrap_or(Self::DEFAULT_LIMIT))
    }
}
