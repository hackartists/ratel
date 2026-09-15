use crate::common::*;
use crate::common::models::auth::AdminUser;
use crate::features::spaces::pages::apps::apps::analyzes::AnalyzeQuotaConfig;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct AnalyzeQuotaResponse {
    /// Limit currently enforced for non-Enterprise members. When the
    /// underlying row hasn't been initialised yet, this echoes the
    /// hardcoded fallback (`AnalyzeQuotaConfig::DEFAULT_LIMIT`).
    pub non_enterprise_limit: i64,
    /// `true` when the row exists in DDB; `false` means the response
    /// is the fallback default and a `PUT` will create the row.
    pub exists: bool,
}

#[get("/api/admin/analyze-quota", _user: AdminUser)]
pub async fn get_analyze_quota() -> Result<AnalyzeQuotaResponse> {
    #[cfg(feature = "server")]
    use postgres::{PostgresEntity, ops::StringOp};

    let row = AnalyzeQuotaConfig::repository()
        .find_one(
            AnalyzeQuotaConfig::query()
                .config_key(StringOp::Eq(AnalyzeQuotaConfig::GLOBAL_KEY.to_string())),
        )
        .await
        .map_err(crate::common::Error::from)?;
    Ok(match row {
        Some(r) => AnalyzeQuotaResponse {
            non_enterprise_limit: r.non_enterprise_limit,
            exists: true,
        },
        None => AnalyzeQuotaResponse {
            non_enterprise_limit: AnalyzeQuotaConfig::DEFAULT_LIMIT,
            exists: false,
        },
    })
}
