use crate::common::*;
use crate::features::posts::models::Team;
use crate::features::social::pages::member::dto::TeamRole;
use crate::features::sub_team::models::SubTeamApplicationStatus;
use crate::features::sub_team::types::{
    ApplicationDecisionReasonRequest, ApplicationReturnCommentRequest,
    SubTeamApplicationDetailResponse, SubTeamApplicationResponse, SubTeamDocAgreementResponse,
    SubTeamError,
};

#[cfg(feature = "server")]
use crate::features::sub_team::models::{SubTeamApplication, SubTeamDocAgreement};
#[cfg(feature = "server")]
use crate::features::sub_team::services::application_lifecycle::{
    approve_application, get_application, reject_application, return_application,
};

#[cfg(feature = "server")]
const PAGE_LIMIT: i64 = 50;

// ── GET /api/teams/:team_pk/sub-teams/applications ─────────────────
#[get("/api/teams/:team_pk/sub-teams/applications?bookmark&status", user: crate::features::auth::User, team: Team, role: TeamRole)]
pub async fn list_parent_applications_handler(
    team_pk: TeamPartition,
    bookmark: Option<String>,
    status: Option<SubTeamApplicationStatus>,
) -> Result<ListResponse<SubTeamApplicationResponse>> {
    let _ = team_pk;
    let _ = user;
    if !role.is_admin_or_owner() {
        return Err(Error::UnauthorizedAccess);
    }
    // `cli` remains needed for the external applicant `Team` joins.
    let cfg = crate::common::CommonConfig::default();
    let cli = cfg.dynamodb();

    let filter = status.unwrap_or(SubTeamApplicationStatus::Pending);

    let page = crate::features::sub_team::services::bookmark_to_page(&bookmark);
    let result = SubTeamApplication::page_by_parent(&team.partition(), page, PAGE_LIMIT)
        .await
        .map_err(|e| {
            crate::error!("list_parent_applications query failed: {e}");
            SubTeamError::ApplicationNotFound
        })?;
    let next = crate::features::sub_team::services::next_bookmark(result.page, result.total_pages);

    // Join each application to its applicant team for display metadata.
    let mut response: Vec<SubTeamApplicationResponse> = Vec::new();
    for app in result.items.into_iter().filter(|a| a.status == filter) {
        let applicant_partition = app.applicant_partition();
        let mut dto: SubTeamApplicationResponse = app.into();
        let applicant_uuid = match &applicant_partition {
            Partition::Team(id) => uuid::Uuid::parse_str(id).ok(),
            _ => None,
        };
        let applicant = match applicant_uuid {
            Some(id) => crate::features::posts::models::Team::get_by_id(id)
                .await
                .ok()
                .flatten(),
            None => None,
        };
        if let Some(applicant) = applicant {
            dto.applicant_team_display_name = applicant.display_name.clone();
            dto.applicant_team_username = applicant.username.clone();
        }
        dto.applicant_member_count =
            crate::features::sub_team::services::count_team_members(cli, &applicant_partition)
                .await
                .unwrap_or(0);
        // Parent is the caller's `team` extractor — no extra ddb read needed.
        dto.parent_team_display_name = team.display_name.clone();
        dto.parent_team_username = team.username.clone();
        response.push(dto);
    }
    Ok((response, next).into())
}

// ── GET /api/teams/:team_pk/sub-teams/applications/:application_id ─
#[get("/api/teams/:team_pk/sub-teams/applications/:application_id", user: crate::features::auth::User, team: Team, role: TeamRole)]
pub async fn get_parent_application_handler(
    team_pk: TeamPartition,
    application_id: String,
) -> Result<SubTeamApplicationDetailResponse> {
    let _ = team_pk;
    let _ = user;
    if !role.is_admin_or_owner() {
        return Err(Error::UnauthorizedAccess);
    }
    let cfg = crate::common::CommonConfig::default();
    let cli = cfg.dynamodb();

    let app = get_application(cli, &team.partition(), &application_id).await?;
    let agreements = list_agreements(&team.partition(), &application_id)
        .await
        .unwrap_or_default();
    let application: SubTeamApplicationResponse = app.into();
    let doc_agreements: Vec<SubTeamDocAgreementResponse> =
        agreements.into_iter().map(Into::into).collect();
    Ok(SubTeamApplicationDetailResponse {
        application,
        doc_agreements,
    })
}

// ── POST /.../applications/:application_id/approve ─────────────────
#[post("/api/teams/:team_pk/sub-teams/applications/:application_id/approve", user: crate::features::auth::User, team: Team, role: TeamRole)]
pub async fn approve_application_handler(
    team_pk: TeamPartition,
    application_id: String,
    body: ApplicationDecisionReasonRequest,
) -> Result<SubTeamApplicationResponse> {
    let _ = team_pk;
    let _ = user;
    if !role.is_admin_or_owner() {
        return Err(Error::UnauthorizedAccess);
    }
    let cfg = crate::common::CommonConfig::default();
    let cli = cfg.dynamodb();

    let app = get_application(cli, &team.partition(), &application_id).await?;
    let updated = approve_application(cli, &team, app, &user.pk(), body.reason).await?;
    Ok(updated.into())
}

// ── POST /.../applications/:application_id/reject ──────────────────
#[post("/api/teams/:team_pk/sub-teams/applications/:application_id/reject", user: crate::features::auth::User, team: Team, role: TeamRole)]
pub async fn reject_application_handler(
    team_pk: TeamPartition,
    application_id: String,
    body: ApplicationDecisionReasonRequest,
) -> Result<SubTeamApplicationResponse> {
    let _ = team_pk;
    let _ = user;
    if !role.is_admin_or_owner() {
        return Err(Error::UnauthorizedAccess);
    }
    let cfg = crate::common::CommonConfig::default();
    let cli = cfg.dynamodb();

    let app = get_application(cli, &team.partition(), &application_id).await?;
    let updated = reject_application(cli, &team, app, body.reason).await?;
    Ok(updated.into())
}

// ── POST /.../applications/:application_id/return ──────────────────
#[post("/api/teams/:team_pk/sub-teams/applications/:application_id/return", user: crate::features::auth::User, team: Team, role: TeamRole)]
pub async fn return_application_handler(
    team_pk: TeamPartition,
    application_id: String,
    body: ApplicationReturnCommentRequest,
) -> Result<SubTeamApplicationResponse> {
    let _ = team_pk;
    let _ = user;
    if !role.is_admin_or_owner() {
        return Err(Error::UnauthorizedAccess);
    }
    let cfg = crate::common::CommonConfig::default();
    let cli = cfg.dynamodb();

    let app = get_application(cli, &team.partition(), &application_id).await?;
    let updated = return_application(cli, &team, app, body.comment).await?;
    Ok(updated.into())
}

#[cfg(feature = "server")]
async fn list_agreements(
    parent_pk: &Partition,
    application_id: &str,
) -> Result<Vec<SubTeamDocAgreement>> {
    SubTeamDocAgreement::list_by_application(parent_pk, application_id).await
}
