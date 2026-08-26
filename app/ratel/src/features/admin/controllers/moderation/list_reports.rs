use crate::common::models::auth::AdminUser;
use crate::common::types::ListResponse;
use crate::features::admin::*;
use crate::features::spaces::pages::actions::actions::discussion::SpacePostCommentReport;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct CommentReportResponse {
    pub reporter_pk: String,
    pub comment_sk: String,
    pub reason: String,
    pub detail: String,
    pub created_at: i64,
}

impl From<SpacePostCommentReport> for CommentReportResponse {
    fn from(r: SpacePostCommentReport) -> Self {
        Self {
            reporter_pk: r.reporter_pk.to_string(),
            comment_sk: r.comment_sk.to_string(),
            reason: format!("{:?}", r.reason),
            detail: r.detail,
            created_at: r.created_at,
        }
    }
}

/// Every report filed against one user — the detail view an admin opens from the
/// moderation queue before deciding to block or dismiss.
#[get("/api/admin/moderation/reports?user_id&bookmark", _user: AdminUser)]
pub async fn list_user_reports(
    user_id: String,
    bookmark: Option<String>,
) -> Result<ListResponse<CommentReportResponse>> {
    let common_config = crate::common::CommonConfig::default();
    let cli = common_config.dynamodb();

    let author_pk = Partition::User(user_id);
    let opt = SpacePostCommentReport::opt_with_bookmark(bookmark).limit(100);
    let (items, next) = SpacePostCommentReport::find_by_author(cli, &author_pk, opt).await?;

    Ok(ListResponse {
        items: items.into_iter().map(Into::into).collect(),
        bookmark: next,
    })
}
