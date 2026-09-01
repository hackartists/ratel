use std::collections::HashSet;

use crate::common::*;
use crate::features::auth::UserTeam;
use crate::features::posts::models::{Team, TeamOwner};
use crate::features::sub_team::models::{
    SubTeamApplication, SubTeamApplicationStatus, SubTeamLink,
};
use crate::features::sub_team::types::SubTeamError;
use postgres::PostgresEntity;
use uuid::Uuid;

/// Parse a `Partition::Team(id)` into its `Uuid` — Postgres `Team`/`TeamOwner`
/// rows are keyed by the raw uuid, not the `"TEAM#…"` partition string.
fn team_uuid(team_pk: &Partition) -> Option<Uuid> {
    match team_pk {
        Partition::Team(id) => Uuid::parse_str(id).ok(),
        _ => None,
    }
}

/// Resolve admin+owner user pks for a team (owner record + UserTeam rows whose
/// role is Admin/Owner). Used by the application-lifecycle notifications to
/// address parent-side decision messages to the right set of recipients.
pub async fn resolve_team_admins(
    _cli: &aws_sdk_dynamodb::Client,
    team_pk: &Partition,
) -> Result<Vec<Partition>> {
    use crate::features::social::pages::member::dto::TeamRole;

    let mut user_pks: HashSet<String> = HashSet::new();

    if let Some(uuid) = team_uuid(team_pk) {
        if let Ok(Some(owner)) = TeamOwner::find_by_team(uuid).await {
            user_pks.insert(owner.user_pk.clone());
        }
    }

    let rows = UserTeam::find_by_team(team_pk).await?;
    for row in rows {
        if matches!(row.role.0, TeamRole::Admin | TeamRole::Owner) {
            user_pks.insert(row.user_pk.clone());
        }
    }

    Ok(user_pks
        .into_iter()
        .filter_map(|s| s.parse::<Partition>().ok())
        .collect())
}

/// Count distinct members currently on the applying team.
///
/// `Team::create_new_team` writes BOTH a `UserTeam` row (role=Owner) and
/// a `TeamOwner` row for the creator — so naively counting both sources
/// double-counts the owner ("팀 멤버가 1명인데 2 members 로 표시되는"
/// 버그). We collect distinct user pks from UserTeam rows first, then
/// only add the owner if their pk is not already present.
pub async fn count_team_members(
    _cli: &aws_sdk_dynamodb::Client,
    team_pk: &Partition,
) -> Result<i64> {
    let mut user_pks: std::collections::HashSet<String> = std::collections::HashSet::new();
    let rows = UserTeam::find_by_team(team_pk).await?;
    for row in rows {
        user_pks.insert(row.user_pk.clone());
    }
    if let Some(uuid) = team_uuid(team_pk) {
        if let Ok(Some(owner)) = TeamOwner::find_by_team(uuid).await {
            user_pks.insert(owner.user_pk.clone());
        }
    }
    Ok(user_pks.len() as i64)
}

/// Load an application by its id from the parent's queue. `_cli` is retained
/// for call-site compatibility (the lookup is now Postgres-backed).
pub async fn get_application(
    _cli: &aws_sdk_dynamodb::Client,
    parent_pk: &Partition,
    application_id: &str,
) -> Result<SubTeamApplication> {
    SubTeamApplication::find_in_parent(parent_pk, application_id)
        .await
        .map_err(|e| {
            crate::error!("get_application query failed: {e}");
            Error::from(SubTeamError::ApplicationNotFound)
        })?
        .ok_or_else(|| SubTeamError::ApplicationNotFound.into())
}

/// Approve an application — transactional:
///   1. application.status = Approved, decided_at, decision_reason=None
///   2. child team.parent_team_id = parent.id, clear pending_parent_team_id
///   3. create SubTeamLink under parent
/// Then notify sub-team admins.
pub async fn approve_application(
    cli: &aws_sdk_dynamodb::Client,
    parent_team: &Team,
    app: SubTeamApplication,
    approver_user_pk: &Partition,
    welcome_message: String,
) -> Result<SubTeamApplication> {
    if !matches!(
        app.status,
        SubTeamApplicationStatus::Pending | SubTeamApplicationStatus::Returned
    ) {
        return Err(SubTeamError::ApplicationStateMismatch.into());
    }

    let now = crate::common::utils::time::get_now_timestamp_millis();
    let parent_team_id = parent_team.id.to_string();
    let sub_team_id = app.sub_team_id.clone();
    let sub_team_pk: Partition = Partition::Team(sub_team_id.clone());

    // ── Postgres transaction: application status + SubTeamLink (atomic) ──
    // The DynamoDB version did app-update + team-update + link-create in one
    // transact_write. `Team` stays in DynamoDB while application + link moved to
    // Postgres, so the atomic set is now the two Postgres writes; the child
    // `Team` linkage follows in a separate DynamoDB write.
    let tx = postgres::Tx::begin().await.map_err(|e| {
        crate::error!("approve_application tx begin failed: {e}");
        Error::from(SubTeamError::ApplicationStateMismatch)
    })?;
    // 1. application update — store the welcome message in `decision_reason`.
    SubTeamApplication::repository()
        .with_tx(&tx)
        .update(
            app.id,
            SubTeamApplication::update()
                .status(SubTeamApplicationStatus::Approved)
                .decision_reason(welcome_message)
                .decided_at(now)
                .updated_at(now),
        )
        .await
        .map_err(|e| {
            crate::error!("approve_application app update failed: {e}");
            Error::from(SubTeamError::ApplicationStateMismatch)
        })?;
    // 3. create SubTeamLink
    let link = SubTeamLink::new(
        parent_team.partition(),
        sub_team_id.clone(),
        approver_user_pk.to_string(),
        app.application_id.clone(),
    );
    SubTeamLink::repository()
        .with_tx(&tx)
        .insert(&link)
        .await
        .map_err(|e| {
            crate::error!("approve_application link create failed: {e}");
            Error::from(SubTeamError::ApplicationStateMismatch)
        })?;
    tx.commit().await.map_err(|e| {
        crate::error!("approve_application tx commit failed: {e}");
        Error::from(SubTeamError::ApplicationStateMismatch)
    })?;

    // 2. child team update — set parent_team_id, clear pending (Postgres).
    let sub_team_uuid = Uuid::parse_str(&sub_team_id).map_err(|e| {
        crate::error!("approve_application: invalid sub_team_id: {e}");
        Error::from(SubTeamError::ApplicationStateMismatch)
    })?;
    Team::repository()
        .update(
            sub_team_uuid,
            Team::update()
                .parent_team_id(Some(parent_team_id.clone()))
                .pending_parent_team_id(None)
                .updated_at(now),
        )
        .await
        .map_err(|e| {
            crate::error!("approve_application team update failed: {:?}", e);
            Error::from(SubTeamError::ApplicationStateMismatch)
        })?;

    // Notifications to sub-team admins
    let parent_team_name = parent_team.display_name.clone();
    let cta_url = build_sub_team_apply_status_url(cli, &sub_team_id).await;
    let admins = resolve_team_admins(cli, &sub_team_pk)
        .await
        .unwrap_or_default();
    for u in admins {
        let payload = InboxPayload::SubTeamApplicationApproved {
            parent_team_id: parent_team_id.clone(),
            parent_team_name: parent_team_name.clone(),
            sub_team_id: sub_team_id.clone(),
            cta_url: cta_url.clone(),
        };
        if let Err(e) = crate::common::utils::inbox::create_inbox_row(u, payload).await {
            crate::error!("approve_application notify failed: {e}");
        }
    }

    let mut updated = app;
    updated.status = SubTeamApplicationStatus::Approved;
    updated.decided_at = Some(now);
    updated.updated_at = now;
    Ok(updated)
}

/// Reject an application. Updates application + clears child team's
/// pending_parent_team_id. Notifies sub-team admins with the reason.
pub async fn reject_application(
    cli: &aws_sdk_dynamodb::Client,
    parent_team: &Team,
    app: SubTeamApplication,
    reason: String,
) -> Result<SubTeamApplication> {
    if !matches!(
        app.status,
        SubTeamApplicationStatus::Pending | SubTeamApplicationStatus::Returned
    ) {
        return Err(SubTeamError::ApplicationStateMismatch.into());
    }
    let now = crate::common::utils::time::get_now_timestamp_millis();
    let parent_team_id = parent_team.id.to_string();
    let sub_team_id = app.sub_team_id.clone();
    let sub_team_pk: Partition = Partition::Team(sub_team_id.clone());

    // Application status (Postgres) then child pending-clear (DynamoDB) — no
    // longer one atomic transact_write (split store).
    SubTeamApplication::repository()
        .update(
            app.id,
            SubTeamApplication::update()
                .status(SubTeamApplicationStatus::Rejected)
                .decision_reason(reason.clone())
                .decided_at(now)
                .updated_at(now),
        )
        .await
        .map_err(|e| {
            crate::error!("reject_application app update failed: {e}");
            Error::from(SubTeamError::ApplicationStateMismatch)
        })?;

    let sub_team_uuid = Uuid::parse_str(&sub_team_id).map_err(|e| {
        crate::error!("reject_application: invalid sub_team_id: {e}");
        Error::from(SubTeamError::ApplicationStateMismatch)
    })?;
    Team::repository()
        .update(
            sub_team_uuid,
            Team::update()
                .pending_parent_team_id(None)
                .updated_at(now),
        )
        .await
        .map_err(|e| {
            crate::error!("reject_application team update failed: {:?}", e);
            Error::from(SubTeamError::ApplicationStateMismatch)
        })?;

    let parent_team_name = parent_team.display_name.clone();
    let cta_url = build_sub_team_apply_status_url(cli, &sub_team_id).await;
    let admins = resolve_team_admins(cli, &sub_team_pk)
        .await
        .unwrap_or_default();
    for u in admins {
        let payload = InboxPayload::SubTeamApplicationRejected {
            parent_team_id: parent_team_id.clone(),
            parent_team_name: parent_team_name.clone(),
            sub_team_id: sub_team_id.clone(),
            reason: reason.clone(),
            cta_url: cta_url.clone(),
        };
        if let Err(e) = crate::common::utils::inbox::create_inbox_row(u, payload).await {
            crate::error!("reject_application notify failed: {e}");
        }
    }

    let mut updated = app;
    updated.status = SubTeamApplicationStatus::Rejected;
    updated.decision_reason = Some(reason);
    updated.decided_at = Some(now);
    updated.updated_at = now;
    Ok(updated)
}

/// Return an application to the applying team for revision. The applying
/// team remains in pending_parent_team_id. Notifies sub-team admins.
pub async fn return_application(
    cli: &aws_sdk_dynamodb::Client,
    parent_team: &Team,
    app: SubTeamApplication,
    comment: String,
) -> Result<SubTeamApplication> {
    if !matches!(app.status, SubTeamApplicationStatus::Pending) {
        return Err(SubTeamError::ApplicationStateMismatch.into());
    }
    let now = crate::common::utils::time::get_now_timestamp_millis();
    let parent_team_id = parent_team.id.to_string();
    let sub_team_id = app.sub_team_id.clone();
    let sub_team_pk: Partition = Partition::Team(sub_team_id.clone());

    SubTeamApplication::repository()
        .update(
            app.id,
            SubTeamApplication::update()
                .status(SubTeamApplicationStatus::Returned)
                .decision_reason(comment.clone())
                .decided_at(now)
                .updated_at(now),
        )
        .await
        .map_err(|e| {
            crate::error!("return_application execute failed: {e}");
            Error::from(SubTeamError::ApplicationStateMismatch)
        })?;

    let parent_team_name = parent_team.display_name.clone();
    let cta_url = build_sub_team_apply_status_url(cli, &sub_team_id).await;
    let admins = resolve_team_admins(cli, &sub_team_pk)
        .await
        .unwrap_or_default();
    for u in admins {
        let payload = InboxPayload::SubTeamApplicationReturned {
            parent_team_id: parent_team_id.clone(),
            parent_team_name: parent_team_name.clone(),
            sub_team_id: sub_team_id.clone(),
            comment: comment.clone(),
            cta_url: cta_url.clone(),
        };
        if let Err(e) = crate::common::utils::inbox::create_inbox_row(u, payload).await {
            crate::error!("return_application notify failed: {e}");
        }
    }

    let mut updated = app;
    updated.status = SubTeamApplicationStatus::Returned;
    updated.decision_reason = Some(comment);
    updated.decided_at = Some(now);
    updated.updated_at = now;
    Ok(updated)
}

/// Notify parent admins that a new application was submitted.
pub async fn notify_parent_of_submission(
    cli: &aws_sdk_dynamodb::Client,
    parent_pk: &Partition,
    parent_team_id: &str,
    application_id: &str,
    sub_team_id: &str,
    sub_team_name: &str,
) {
    let cta_url = build_sub_team_management_url(cli, parent_team_id).await;
    let admins = resolve_team_admins(cli, parent_pk).await.unwrap_or_default();
    for u in admins {
        let payload = InboxPayload::SubTeamApplicationSubmitted {
            parent_team_id: parent_team_id.to_string(),
            application_id: application_id.to_string(),
            sub_team_id: sub_team_id.to_string(),
            sub_team_name: sub_team_name.to_string(),
            cta_url: cta_url.clone(),
        };
        if let Err(e) = crate::common::utils::inbox::create_inbox_row(u, payload).await {
            crate::error!("notify_parent_of_submission failed: {e}");
        }
    }
}

/// URL of the sub-team's "Application status" page. The Dioxus route is
/// `/:username/sub-teams/application`, so we resolve the sub-team's
/// `username` from its team id before building the link. Fallback is
/// the team home (`/:username`) when the lookup fails.
async fn build_sub_team_apply_status_url(
    _cli: &aws_sdk_dynamodb::Client,
    sub_team_id: &str,
) -> String {
    let username = match Uuid::parse_str(sub_team_id) {
        Ok(uuid) => crate::features::posts::models::Team::get_by_id(uuid)
            .await
            .ok()
            .flatten()
            .map(|t| t.username)
            .unwrap_or_default(),
        Err(_) => String::new(),
    };
    if username.is_empty() {
        // Better to land on the home route than a 404 with the bare id.
        format!("/{sub_team_id}")
    } else {
        format!("/{username}/sub-teams/application")
    }
}

/// URL of the parent's "Sub-team management" page. Route is
/// `/:username/sub-teams/manage`.
async fn build_sub_team_management_url(
    _cli: &aws_sdk_dynamodb::Client,
    parent_team_id: &str,
) -> String {
    let username = match Uuid::parse_str(parent_team_id) {
        Ok(uuid) => crate::features::posts::models::Team::get_by_id(uuid)
            .await
            .ok()
            .flatten()
            .map(|t| t.username)
            .unwrap_or_default(),
        Err(_) => String::new(),
    };
    if username.is_empty() {
        format!("/{parent_team_id}")
    } else {
        format!("/{username}/sub-teams/manage")
    }
}
