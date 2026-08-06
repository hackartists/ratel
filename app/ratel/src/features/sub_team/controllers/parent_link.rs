use crate::common::*;
use crate::features::posts::models::Team;
use crate::features::social::pages::member::dto::TeamRole;
use crate::features::sub_team::types::{
    DeregisterRequest, LeaveParentRequest, SubTeamError, TerminationAck,
};

#[cfg(feature = "server")]
use crate::features::sub_team::models::{SubTeamApplication, SubTeamApplicationStatus, SubTeamLink};
#[cfg(feature = "server")]
use crate::features::sub_team::services::termination::{
    build_parent_sub_teams_url, build_sub_team_parent_url, detach_sub_team_link, notify_team_admins,
};
#[cfg(feature = "server")]
use postgres::PostgresEntity;

// ── POST /api/teams/:team_pk/sub-teams/:sub_team_id/deregister ──────
#[post(
    "/api/teams/:team_pk/sub-teams/:sub_team_id/deregister",
    user: crate::features::auth::User,
    team: Team,
    role: TeamRole
)]
pub async fn deregister_sub_team_handler(
    team_pk: TeamPartition,
    sub_team_id: String,
    body: DeregisterRequest,
) -> Result<TerminationAck> {
    let _ = team_pk;
    let _ = user;
    if !role.is_admin_or_owner() {
        return Err(Error::UnauthorizedAccess);
    }
    if body.reason.trim().is_empty() {
        return Err(SubTeamError::ApplicationStateMismatch.into());
    }

    let cfg = crate::common::CommonConfig::default();
    let cli = cfg.dynamodb();

    // 1. Confirm SubTeamLink exists under parent pk.
    let link = SubTeamLink::find_link(&team.partition(), &sub_team_id)
        .await
        .map_err(|e| {
            crate::error!("deregister_sub_team link lookup failed: {e}");
            SubTeamError::SubTeamLinkNotFound
        })?
        .ok_or(SubTeamError::SubTeamLinkNotFound)?;
    let _ = link;

    let child_pk: Partition = Partition::Team(sub_team_id.clone());

    // 2. Delete link + clear child parent_team_id.
    detach_sub_team_link(cli, &team.partition(), &child_pk, &sub_team_id).await?;

    // 3. Cancel every application the (now former) sub-team submitted here.
    let former_parent_team_id = team.id.to_string();
    if !former_parent_team_id.is_empty() {
        if let Err(e) = cancel_applications_for_parent(&child_pk, &former_parent_team_id).await {
            crate::error!("deregister_sub_team: cancel applications failed: {e:?}");
        }
    }

    // 4. Notify former sub-team admins.
    let former_parent_team_name = team.display_name.clone();
    let reason = body.reason.clone();
    let cta_url = build_sub_team_parent_url(cli, &sub_team_id).await;
    notify_team_admins(cli, &child_pk, move || {
        InboxPayload::SubTeamDeregistered {
            former_parent_team_id: former_parent_team_id.clone(),
            former_parent_team_name: former_parent_team_name.clone(),
            sub_team_id: sub_team_id.clone(),
            reason: reason.clone(),
            cta_url: cta_url.clone(),
        }
    })
    .await;

    Ok(TerminationAck { ok: true })
}

// ── POST /api/teams/:team_pk/parent/leave ───────────────────────────
#[post(
    "/api/teams/:team_pk/parent/leave",
    user: crate::features::auth::User,
    team: Team,
    role: TeamRole
)]
pub async fn leave_parent_handler(
    team_pk: TeamPartition,
    body: LeaveParentRequest,
) -> Result<TerminationAck> {
    let _ = team_pk;
    let _ = user;
    if !role.is_admin_or_owner() {
        return Err(Error::UnauthorizedAccess);
    }

    let cfg = crate::common::CommonConfig::default();
    let cli = cfg.dynamodb();

    // 1. Must currently be a recognized sub-team.
    let parent_team_id = team.parent_team_id.clone().ok_or(SubTeamError::NotASubTeam)?;

    let sub_team_id = team.id.to_string();
    let parent_pk: Partition = Partition::Team(parent_team_id.clone());

    // 2. Best-effort: confirm SubTeamLink exists.
    let maybe_link = SubTeamLink::find_link(&parent_pk, &sub_team_id)
        .await
        .unwrap_or(None);

    if maybe_link.is_some() {
        detach_sub_team_link(cli, &parent_pk, &team.partition(), &sub_team_id).await?;
    } else {
        // Clear the orphan parent_team_id on the child without touching a link.
        let now = crate::common::utils::time::get_now_timestamp_millis();
        Team::repository()
            .update(
                team.id,
                Team::update().parent_team_id(None).updated_at(now),
            )
            .await
            .map_err(|e| {
                crate::error!("leave_parent orphan-clear failed: {e}");
                Error::from(SubTeamError::ApplicationStateMismatch)
            })?;
    }

    // 3. Cancel every application this team submitted to the parent.
    if let Err(e) = cancel_applications_for_parent(&team.partition(), &parent_team_id).await {
        crate::error!("leave_parent_handler: cancel applications failed: {e:?}");
    }

    // 4. Notify former parent admins.
    let former_sub_team_id = sub_team_id.clone();
    let former_sub_team_name = team.display_name.clone();
    let former_parent_team_id = parent_team_id.clone();
    let reason = body.reason.clone();
    let cta_url = build_parent_sub_teams_url(cli, &parent_team_id).await;
    notify_team_admins(cli, &parent_pk, move || {
        InboxPayload::SubTeamLeftParent {
            former_parent_team_id: former_parent_team_id.clone(),
            former_sub_team_id: former_sub_team_id.clone(),
            former_sub_team_name: former_sub_team_name.clone(),
            reason: reason.clone(),
            cta_url: cta_url.clone(),
        }
    })
    .await;

    Ok(TerminationAck { ok: true })
}

/// Flips every application this team submitted to `parent_team_id` to
/// `Cancelled` so the relationship teardown removes them from the applicant's
/// status view. Best-effort — per-row failures are logged. The applicant's
/// application history is the `applicant_team_pk` index.
#[cfg(feature = "server")]
async fn cancel_applications_for_parent(
    applicant_pk: &Partition,
    parent_team_id: &str,
) -> Result<()> {
    let now = crate::common::utils::time::get_now_timestamp_millis();
    let apps = SubTeamApplication::find_by_applicant_all(applicant_pk).await?;
    for app in apps {
        if app.parent_team_id != parent_team_id {
            continue;
        }
        // Skip rows already in a terminal state we don't want to overwrite.
        if matches!(
            app.status,
            SubTeamApplicationStatus::Cancelled | SubTeamApplicationStatus::Draft
        ) {
            continue;
        }
        if let Err(e) = SubTeamApplication::repository()
            .update(
                app.id,
                SubTeamApplication::update()
                    .status(SubTeamApplicationStatus::Cancelled)
                    .updated_at(now),
            )
            .await
        {
            crate::error!(
                "cancel_applications_for_parent: update failed for {}: {e:?}",
                app.application_id
            );
        }
    }
    Ok(())
}

// Silence unused-import warnings when body types live only here.
#[cfg(feature = "server")]
fn _unused_silencer() {
    let _ = DeregisterRequest::default();
    let _ = LeaveParentRequest::default();
    let _ = TerminationAck::default();
}
