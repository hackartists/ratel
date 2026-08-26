use crate::common::models::auth::AdminUser;
use crate::common::models::moderation::ModerationSetting;
use crate::common::utils::time::get_now_timestamp;
use crate::features::admin::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct ModerationSettingResponse {
    pub report_threshold: u64,
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
    pub report_threshold: u64,
}

/// Read the admin-configurable report threshold (falls back to the default).
#[get("/api/admin/moderation/setting", _user: AdminUser)]
pub async fn get_moderation_setting() -> Result<ModerationSettingResponse> {
    let common_config = crate::common::CommonConfig::default();
    let cli = common_config.dynamodb();

    let (pk, sk) = ModerationSetting::keys();
    let setting = ModerationSetting::get(cli, &pk, Some(sk))
        .await?
        .unwrap_or_default();
    Ok(setting.into())
}

/// Update the report threshold that triggers auto-hide + admin review.
#[post("/api/admin/moderation/setting", _user: AdminUser)]
pub async fn update_moderation_setting(
    req: UpdateModerationSettingRequest,
) -> Result<ModerationSettingResponse> {
    let common_config = crate::common::CommonConfig::default();
    let cli = common_config.dynamodb();

    let mut setting = ModerationSetting::default();
    setting.report_threshold = req.report_threshold.max(1);
    setting.updated_at = get_now_timestamp();
    setting.create(cli).await?;

    Ok(setting.into())
}
