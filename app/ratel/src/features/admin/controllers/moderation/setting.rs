use crate::common::models::auth::AdminUser;
use crate::common::models::moderation::{DEFAULT_REPORT_THRESHOLD, ModerationSetting};
use crate::common::utils::time::get_now_timestamp;
use crate::features::admin::*;
#[cfg(feature = "server")]
use postgres::PostgresEntity;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct ModerationSettingResponse {
    pub report_threshold: i64,
    pub updated_at: i64,
}

impl From<ModerationSetting> for ModerationSettingResponse {
    fn from(s: ModerationSetting) -> Self {
        Self {
            report_threshold: s.report_threshold,
            updated_at: s.updated_at,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateModerationSettingRequest {
    pub report_threshold: i64,
}

/// Read the admin-configurable report threshold (falls back to the default).
#[get("/api/admin/moderation/setting", _user: AdminUser)]
pub async fn get_moderation_setting() -> Result<ModerationSettingResponse> {
    Ok(match ModerationSetting::load().await {
        Some(s) => s.into(),
        None => ModerationSettingResponse {
            report_threshold: DEFAULT_REPORT_THRESHOLD,
            updated_at: 0,
        },
    })
}

/// Update the report threshold. Clamped to >= 1 — a 0 threshold would auto-hide
/// every comment on its first report.
#[patch("/api/admin/moderation/setting", _user: AdminUser)]
pub async fn update_moderation_setting(
    req: UpdateModerationSettingRequest,
) -> Result<ModerationSettingResponse> {
    let threshold = req.report_threshold.max(1);
    let now = get_now_timestamp();

    let row = match ModerationSetting::load().await {
        Some(existing) => ModerationSetting::repository()
            .update(
                existing.id,
                ModerationSetting::update()
                    .report_threshold(threshold)
                    .updated_at(now),
            )
            .await
            .map_err(|e| {
                crate::error!("failed to update moderation setting: {e}");
                Error::NoPermission
            })?,
        None => {
            let mut s = ModerationSetting::default();
            s.id = uuid::Uuid::now_v7();
            s.report_threshold = threshold;
            s.updated_at = now;
            ModerationSetting::repository()
                .insert(&s)
                .await
                .map_err(|e| {
                    crate::error!("failed to create moderation setting: {e}");
                    Error::NoPermission
                })?
        }
    };

    Ok(row.into())
}
