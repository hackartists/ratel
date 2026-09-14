use crate::common::models::auth::AdminUser;
use crate::common::models::moderation::{ModerationStatus, UserModerationFlag};
use crate::common::types::ListResponse;
use crate::features::admin::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct ModerationFlagResponse {
    pub user_pk: String,
    pub display_name: String,
    pub username: String,
    pub report_count: i64,
    pub status: String,
    pub updated_at: i64,
}

impl From<UserModerationFlag> for ModerationFlagResponse {
    fn from(f: UserModerationFlag) -> Self {
        Self {
            user_pk: f.user_pk,
            display_name: f.display_name,
            username: f.username,
            report_count: f.report_count,
            status: f.status.to_string(),
            updated_at: f.updated_at,
        }
    }
}

/// Admin moderation queue (App Store req #5): flagged users by status. Defaults
/// to `PendingReview` — the users awaiting an admin decision.
#[get("/api/admin/moderation/flags?status&bookmark", _user: AdminUser)]
pub async fn list_moderation_flags(
    status: Option<String>,
    bookmark: Option<String>,
) -> Result<ListResponse<ModerationFlagResponse>> {
    let status = status
        .and_then(|s| s.parse::<ModerationStatus>().ok())
        .unwrap_or(ModerationStatus::PendingReview);

    let (items, next) = UserModerationFlag::list_by_status(status, bookmark, 50).await?;

    Ok(ListResponse {
        items: items.into_iter().map(Into::into).collect(),
        bookmark: next,
    })
}
