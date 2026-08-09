use crate::common::*;
use crate::common::models::auth::AdminUser;
use crate::common::utils::time::get_now_timestamp_millis;
use crate::features::spaces::pages::apps::apps::analyzes::AnalyzeQuotaConfig;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub struct UpdateAnalyzeQuotaRequest {
    /// New limit for non-Enterprise members, applied space-wide.
    /// Must be `>= 0`. Setting to `0` effectively blocks every
    /// non-Enterprise create until raised.
    pub non_enterprise_limit: i64,
}

/// Upsert the singleton AnalyzeQuotaConfig row. First call creates it;
/// subsequent calls patch `non_enterprise_limit` + `updated_at`.
#[put("/api/admin/analyze-quota", _user: AdminUser)]
pub async fn update_analyze_quota(
    req: UpdateAnalyzeQuotaRequest,
) -> Result<AnalyzeQuotaConfig> {
    #[cfg(feature = "server")]
    use postgres::{PostgresEntity, ops::StringOp};

    if req.non_enterprise_limit < 0 {
        return Err(Error::InvalidFormat);
    }

    let now = get_now_timestamp_millis();

    let existing = AnalyzeQuotaConfig::repository()
        .find_one(
            AnalyzeQuotaConfig::query()
                .config_key(StringOp::Eq(AnalyzeQuotaConfig::GLOBAL_KEY.to_string())),
        )
        .await
        .map_err(|e| {
            crate::error!("update_analyze_quota: {e}");
            Error::Internal
        })?;

    let row = match existing {
        Some(existing) => AnalyzeQuotaConfig::repository()
            .update(
                existing.id,
                AnalyzeQuotaConfig::update()
                    .non_enterprise_limit(req.non_enterprise_limit)
                    .updated_at(now),
            )
            .await
            .map_err(|e| {
                crate::error!("update_analyze_quota: {e}");
                Error::Internal
            })?,
        None => {
            let row = AnalyzeQuotaConfig {
                id: uuid::Uuid::now_v7(),
                config_key: AnalyzeQuotaConfig::GLOBAL_KEY.to_string(),
                created_at: now,
                updated_at: now,
                non_enterprise_limit: req.non_enterprise_limit,
            };
            AnalyzeQuotaConfig::repository()
                .insert(&row)
                .await
                .map_err(|e| {
                    crate::error!("update_analyze_quota create: {e}");
                    Error::Internal
                })?
        }
    };

    Ok(row)
}
