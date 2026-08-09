//! Direct-to-one-sub-team announcement endpoint (read side).
//!
//! Powers the history rows under the "이 하위팀에만 공지" card on the
//! parent's sub-team detail page. The send side goes through the shared
//! broadcast composer (`create_announcement_handler` +
//! `publish_announcement_handler` with `target_child_team_id` set).

use crate::common::*;
#[cfg(feature = "server")]
use crate::features::posts::models::Team;
use crate::features::social::pages::member::dto::TeamRole;
use crate::features::sub_team::types::{SubTeamAnnouncementResponse, SubTeamError};

#[cfg(feature = "server")]
use crate::features::sub_team::models::SubTeamAnnouncementStatus;

#[cfg(feature = "server")]
const PAGE_LIMIT: i64 = 100;

// ── GET /api/teams/:team_pk/sub-teams/:sub_team_id/direct-messages ───────
#[get(
    "/api/teams/:team_pk/sub-teams/:sub_team_id/direct-messages?bookmark",
    user: crate::features::auth::User,
    team: Team,
    role: TeamRole
)]
pub async fn list_direct_messages_handler(
    team_pk: TeamPartition,
    sub_team_id: String,
    bookmark: Option<String>,
) -> Result<ListResponse<SubTeamAnnouncementResponse>> {
    let _ = team_pk;
    let _ = user;
    if !role.is_admin_or_owner() {
        return Err(Error::UnauthorizedAccess);
    }

    let page = crate::features::sub_team::services::bookmark_to_page(&bookmark);
    let result =
        crate::features::sub_team::models::SubTeamAnnouncement::page_for_team(&team.partition(), page, PAGE_LIMIT)
            .await
            .map_err(|e| {
                crate::error!("list_direct_messages query failed: {e}");
                SubTeamError::AnnouncementNotFound
            })?;
    let next = crate::features::sub_team::services::next_bookmark(result.page, result.total_pages);

    let mut items: Vec<_> = result
        .items
        .into_iter()
        .filter(|a| {
            a.target_child_team_id.as_deref() == Some(sub_team_id.as_str())
                && !matches!(a.status, SubTeamAnnouncementStatus::Deleted)
        })
        .collect();
    items.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    // Anchor Post pk for every direct message is deterministic
    // (`Feed(announcement_id)`), so fill in `target_post_pk` directly.
    for a in items.iter_mut() {
        if a.target_post_pk.is_none() {
            a.target_post_pk = Some(Partition::Feed(a.announcement_id.clone()).to_string());
        }
    }

    let response: Vec<SubTeamAnnouncementResponse> = items.into_iter().map(Into::into).collect();
    Ok((response, next).into())
}
