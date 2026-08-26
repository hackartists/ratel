use crate::common::models::auth::AdminUser;
use crate::common::models::moderation::{ModerationStatus, UserModerationFlag};
use crate::common::types::ListResponse;
use crate::features::admin::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct ModerationFlagResponse {
    pub user_pk: String,
    pub display_name: String,
    pub username: String,
    pub report_count: u64,
    pub status: String,
    pub updated_at: i64,
}

impl From<UserModerationFlag> for ModerationFlagResponse {
    fn from(f: UserModerationFlag) -> Self {
        Self {
            user_pk: f.user_pk.to_string(),
            display_name: f.display_name,
            username: f.username,
            report_count: f.report_count,
            status: f.status.to_string(),
            updated_at: f.updated_at,
        }
    }
}

/// Admin moderation queue (App Store req #5): flagged users by status. Defaults
/// to `PendingReview` — the users whose report tally crossed the threshold and
/// await an admin decision.
#[get("/api/admin/moderation/flags?status&bookmark", _user: AdminUser)]
pub async fn list_moderation_flags(
    status: Option<String>,
    bookmark: Option<String>,
) -> Result<ListResponse<ModerationFlagResponse>> {
    let common_config = crate::common::CommonConfig::default();
    let cli = common_config.dynamodb();

    let status = status
        .and_then(|s| s.parse::<ModerationStatus>().ok())
        .unwrap_or(ModerationStatus::PendingReview);

    let opt = UserModerationFlag::opt_with_bookmark(bookmark).limit(50);
    let (items, next) = UserModerationFlag::find_by_status(cli, status, opt).await?;

    Ok(ListResponse {
        items: items.into_iter().map(Into::into).collect(),
        bookmark: next,
    })
}
