use crate::common::*;
#[cfg(feature = "server")]
use crate::features::posts::models::Team;
use crate::features::social::pages::member::dto::TeamRole;
use crate::features::sub_team::types::{
    ApplicationDecisionReasonRequest, ApplicationReturnCommentRequest, ParentRelationshipResponse,
    ParentRelationshipStatus, SubTeamApplicationDetailResponse, SubTeamApplicationResponse,
    SubTeamDocAgreementResponse, SubTeamError, SubmitApplicationRequest, UpdateApplicationRequest,
};

#[cfg(feature = "server")]
use crate::features::sub_team::models::json::FormValues;
#[cfg(feature = "server")]
use crate::features::sub_team::models::{
    FormSnapshotList, SubTeamApplication, SubTeamApplicationStatus, SubTeamDocAgreement,
    SubTeamDocument, SubTeamFormField, SubTeamFormFieldSnapshot, SubTeamLink,
};
#[cfg(feature = "server")]
use crate::features::sub_team::services::application_lifecycle::{
    count_team_members, notify_parent_of_submission,
};
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
use uuid::Uuid;

#[cfg(feature = "server")]
const PAGE_LIMIT: i64 = 50;

// ── GET /api/teams/:team_pk/parent — summary ───────────────────────
#[get("/api/teams/:team_pk/parent", user: crate::features::auth::User, team: Team, role: TeamRole)]
pub async fn get_parent_relationship_handler(
    team_pk: TeamPartition,
) -> Result<ParentRelationshipResponse> {
    let _ = team_pk;
    let _ = user;
    // Membership already enforced by the `role: TeamRole` extractor; plain
    // members can read the parent HUD (read-only).
    let _ = role;

    let status = if team.parent_team_id.is_some() {
        ParentRelationshipStatus::RecognizedSubTeam
    } else if team.pending_parent_team_id.is_some() {
        ParentRelationshipStatus::PendingSubTeam
    } else {
        ParentRelationshipStatus::Standalone
    };

    let latest_application_id = match find_latest_application(&team.partition()).await {
        Ok(app) => app.map(|a| a.application_id),
        Err(e) => {
            crate::error!("get_parent_relationship latest app lookup failed: {e}");
            None
        }
    };

    let parent_uuid_for_join = team
        .parent_team_id
        .clone()
        .or_else(|| team.pending_parent_team_id.clone());
    let (parent_display_name, parent_username, recognized_at) = match parent_uuid_for_join {
        Some(uuid_str) => {
            let parent_pk = Partition::Team(uuid_str.clone());
            let display = match Uuid::parse_str(&uuid_str) {
                Ok(uuid) => Team::get_by_id(uuid).await.ok().flatten(),
                Err(_) => None,
            };
            let (name, username) = match display {
                Some(t) => (Some(t.display_name), Some(t.username)),
                None => (None, None),
            };
            let recognized_at = if matches!(status, ParentRelationshipStatus::RecognizedSubTeam) {
                find_recognition_timestamp(&parent_pk, &team.partition()).await.ok().flatten()
            } else {
                None
            };
            (name, username, recognized_at)
        }
        None => (None, None, None),
    };

    Ok(ParentRelationshipResponse {
        status,
        parent_team_id: team.parent_team_id,
        pending_parent_team_id: team.pending_parent_team_id,
        latest_application_id,
        parent_team_display_name: parent_display_name,
        parent_team_username: parent_username,
        recognized_at,
    })
}

// Walks SubTeamLink rows under `parent_pk` and returns the `approved_at` of the
// link whose child team matches `child_pk`.
#[cfg(feature = "server")]
async fn find_recognition_timestamp(
    parent_pk: &Partition,
    child_pk: &Partition,
) -> Result<Option<i64>> {
    let links = SubTeamLink::list_for_parent(parent_pk).await?;
    let child_uuid = match child_pk {
        Partition::Team(id) => id.clone(),
        _ => return Ok(None),
    };
    Ok(links
        .into_iter()
        .find(|l| l.child_team_id == child_uuid)
        .map(|l| l.approved_at))
}

// ── GET /api/teams/:team_pk/parent/applications ────────────────────
#[get("/api/teams/:team_pk/parent/applications?bookmark", user: crate::features::auth::User, team: Team, role: TeamRole)]
pub async fn list_child_applications_handler(
    team_pk: TeamPartition,
    bookmark: Option<String>,
) -> Result<ListResponse<SubTeamApplicationResponse>> {
    let _ = team_pk;
    let _ = user;
    if !role.is_admin_or_owner() {
        return Err(Error::UnauthorizedAccess);
    }

    let page = crate::features::sub_team::services::bookmark_to_page(&bookmark);
    let result = SubTeamApplication::page_by_applicant(&team.partition(), page, PAGE_LIMIT)
        .await
        .map_err(|e| {
            crate::error!("list_child_applications query failed: {e}");
            SubTeamError::ApplicationNotFound
        })?;
    let next = crate::features::sub_team::services::next_bookmark(result.page, result.total_pages);

    // Join each application to its parent team for display metadata.
    let mut response: Vec<SubTeamApplicationResponse> = Vec::new();
    for app in result.items.into_iter() {
        let parent_uuid = Uuid::parse_str(&app.parent_team_id).ok();
        let mut dto: SubTeamApplicationResponse = app.into();
        // Applicant is the caller's `team`.
        dto.applicant_team_display_name = team.display_name.clone();
        dto.applicant_team_username = team.username.clone();
        let parent = match parent_uuid {
            Some(uuid) => crate::features::posts::models::Team::get_by_id(uuid)
                .await
                .ok()
                .flatten(),
            None => None,
        };
        if let Some(parent) = parent {
            dto.parent_team_display_name = parent.display_name;
            dto.parent_team_username = parent.username;
        }
        response.push(dto);
    }
    Ok((response, next).into())
}

// ── POST /api/teams/:team_pk/parent/applications — submit ──────────
#[post("/api/teams/:team_pk/parent/applications", user: crate::features::auth::User, team: Team, role: TeamRole)]
pub async fn submit_application_handler(
    team_pk: TeamPartition,
    body: SubmitApplicationRequest,
) -> Result<SubTeamApplicationResponse> {
    let _ = team_pk;
    let _ = user;
    if !role.is_admin_or_owner() {
        return Err(Error::UnauthorizedAccess);
    }
    // `cli` remains needed for the external `Team` load / pending update.
    let cfg = crate::common::CommonConfig::default();
    let cli = cfg.dynamodb();

    // 1. Applying team pulled from extractor `team`.
    if team.parent_team_id.is_some() {
        return Err(SubTeamError::AlreadyRecognizedSubTeam.into());
    }

    // 2. Parent must exist AND be parent-eligible.
    let parent_uuid = Uuid::parse_str(&body.parent_team_id)
        .map_err(|_| SubTeamError::ParentNotEligible)?;
    let parent = Team::get_by_id(parent_uuid)
        .await
        .map_err(|e| {
            crate::error!("submit_application parent load failed: {e}");
            SubTeamError::ParentNotEligible
        })?
        .ok_or(SubTeamError::ParentNotEligible)?;
    if !parent.is_parent_eligible {
        return Err(SubTeamError::ParentNotEligible.into());
    }

    // 4. Cycle: cannot apply to self; cannot apply to own existing sub-team.
    if parent.id == team.id {
        return Err(SubTeamError::CycleDetected.into());
    }
    if is_parent_already_sub_team_of_child(&team.partition(), &parent.partition())
        .await
        .map_err(|e| {
            crate::error!("cycle detection failed: {e}");
            Error::from(SubTeamError::CycleDetected)
        })?
    {
        return Err(SubTeamError::CycleDetected.into());
    }

    // 3. Resubmit path — reuse a Returned application for THIS parent.
    let now = crate::common::utils::time::get_now_timestamp_millis();
    let returned_existing = find_returned_application(&team.partition(), &body.parent_team_id)
        .await
        .map_err(|e| {
            crate::error!("returned lookup failed: {e}");
            Error::from(SubTeamError::ApplicationStateMismatch)
        })?;

    if let Some(existing) = returned_existing {
        let member_count = count_team_members(cli, &team.partition()).await.map_err(|e| {
            crate::error!("member count failed: {e}");
            Error::from(SubTeamError::MemberCountBelowMinimum)
        })?;
        if member_count < parent.min_sub_team_members as i64 {
            return Err(SubTeamError::MemberCountBelowMinimum.into());
        }
        if !meets_min_age(team.created_at, parent.min_sub_team_age_days, now) {
            return Err(SubTeamError::TeamAgeBelowMinimum.into());
        }
        validate_form_values(&[], &body.form_values).ok();

        SubTeamApplication::repository()
            .update(
                existing.id,
                SubTeamApplication::update()
                    .status(SubTeamApplicationStatus::Pending)
                    .submitted_at(now)
                    .updated_at(now)
                    .decision_reason(String::new())
                    .form_values(FormValues(body.form_values.clone())),
            )
            .await
            .map_err(|e| {
                crate::error!("resubmit application update failed: {:?}", e);
                Error::from(SubTeamError::ApplicationStateMismatch)
            })?;

        notify_parent_of_submission(
            cli,
            &parent.partition(),
            &body.parent_team_id,
            &existing.application_id,
            &existing.sub_team_id,
            &team.display_name,
        )
        .await;

        // Load fresh row so the response carries the updated fields.
        let existing_app_id = existing.application_id.clone();
        let refreshed = SubTeamApplication::find_in_applicant(&team.partition(), &existing_app_id)
            .await
            .map_err(|e| {
                crate::error!("resubmit refresh failed: {:?}", e);
                Error::from(SubTeamError::ApplicationStateMismatch)
            })?
            .unwrap_or(existing);
        return Ok(refreshed.into());
    }

    // 4. New-submit path — block when any in-flight app exists.
    if has_in_flight_application(&team.partition()).await.map_err(|e| {
        crate::error!("in-flight lookup failed: {e}");
        Error::from(SubTeamError::ApplicationInFlight)
    })? {
        return Err(SubTeamError::ApplicationInFlight.into());
    }

    // 5. Member count ≥ parent.min_sub_team_members.
    let member_count = count_team_members(cli, &team.partition()).await.map_err(|e| {
        crate::error!("member count failed: {e}");
        Error::from(SubTeamError::MemberCountBelowMinimum)
    })?;
    if member_count < parent.min_sub_team_members as i64 {
        return Err(SubTeamError::MemberCountBelowMinimum.into());
    }

    // 5b. Team age ≥ parent.min_sub_team_age_days.
    if !meets_min_age(team.created_at, parent.min_sub_team_age_days, now) {
        return Err(SubTeamError::TeamAgeBelowMinimum.into());
    }

    // 6+7. Load parent's form fields and docs.
    let parent_form_fields = load_form_fields(&parent.partition()).await.map_err(|e| {
        crate::error!("form fields load failed: {e}");
        Error::from(SubTeamError::MissingRequiredFormField)
    })?;
    let parent_docs = load_docs(&parent.partition()).await.map_err(|e| {
        crate::error!("docs load failed: {e}");
        Error::from(SubTeamError::MissingRequiredDocAgreement)
    })?;

    validate_form_values(&parent_form_fields, &body.form_values)?;
    let agreed_docs = validate_doc_agreements(&parent_docs, &body.doc_agreements)?;

    // 8. Application + doc agreements (Postgres tx) + pending_parent (DynamoDB).
    let parent_team_id = parent.id.to_string();
    let sub_team_id = team.id.to_string();

    let mut application = SubTeamApplication::new(
        parent.partition(),
        team.partition(),
        parent_team_id.clone(),
        sub_team_id.clone(),
        user.pk().to_string(),
    );
    application.status = SubTeamApplicationStatus::Pending;
    application.submitted_at = Some(now);
    application.updated_at = now;
    application.form_values = FormValues(body.form_values.clone());
    application.form_snapshot = FormSnapshotList(
        parent_form_fields
            .iter()
            .map(|f| SubTeamFormFieldSnapshot {
                field_id: f.id.to_string(),
                label: f.label.clone(),
                field_type: f.field_type,
                required: f.required,
                order: f.order,
                options: f.options.0.clone(),
                locked: f.locked,
            })
            .collect(),
    );

    let tx = postgres::Tx::begin().await.map_err(|e| {
        crate::error!("submit_application tx begin failed: {e}");
        Error::from(SubTeamError::ApplicationStateMismatch)
    })?;
    SubTeamApplication::repository()
        .with_tx(&tx)
        .insert(&application)
        .await
        .map_err(|e| {
            crate::error!("submit_application insert failed: {e}");
            Error::from(SubTeamError::ApplicationStateMismatch)
        })?;
    for (doc, hash) in agreed_docs {
        let agreement = SubTeamDocAgreement::new(
            parent.partition(),
            application.application_id.clone(),
            doc.id.to_string(),
            doc.title.clone(),
            hash,
            user.pk().to_string(),
        );
        SubTeamDocAgreement::repository()
            .with_tx(&tx)
            .insert(&agreement)
            .await
            .map_err(|e| {
                crate::error!("submit_application agreement insert failed: {e}");
                Error::from(SubTeamError::ApplicationStateMismatch)
            })?;
    }
    tx.commit().await.map_err(|e| {
        crate::error!("submit_application tx commit failed: {e}");
        Error::from(SubTeamError::ApplicationStateMismatch)
    })?;

    // Child team pending_parent linkage (Postgres).
    Team::repository()
        .update(
            team.id,
            Team::update()
                .pending_parent_team_id(Some(parent_team_id.clone()))
                .updated_at(now),
        )
        .await
        .map_err(|e| {
            crate::error!("submit_application team pending update failed: {:?}", e);
            Error::from(SubTeamError::ApplicationStateMismatch)
        })?;

    // 9. Notify parent admins.
    notify_parent_of_submission(
        cli,
        &parent.partition(),
        &parent_team_id,
        &application.application_id,
        &sub_team_id,
        &team.display_name,
    )
    .await;

    Ok(application.into())
}

// ── GET /api/teams/:team_pk/parent/applications/:application_id ────
#[get("/api/teams/:team_pk/parent/applications/:application_id", user: crate::features::auth::User, team: Team, role: TeamRole)]
pub async fn get_child_application_handler(
    team_pk: TeamPartition,
    application_id: String,
) -> Result<SubTeamApplicationDetailResponse> {
    let _ = team_pk;
    let _ = user;
    if !role.is_admin_or_owner() {
        return Err(Error::UnauthorizedAccess);
    }

    let app = find_application_for_child(&team.partition(), &application_id).await?;
    let parent_pk = app.parent_partition();
    let agreements = SubTeamDocAgreement::list_by_application(&parent_pk, &application_id)
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

// ── PATCH /api/teams/:team_pk/parent/applications/:application_id ──
#[patch("/api/teams/:team_pk/parent/applications/:application_id", user: crate::features::auth::User, team: Team, role: TeamRole)]
pub async fn update_child_application_handler(
    team_pk: TeamPartition,
    application_id: String,
    body: UpdateApplicationRequest,
) -> Result<SubTeamApplicationResponse> {
    let _ = team_pk;
    let _ = user;
    if !role.is_admin_or_owner() {
        return Err(Error::UnauthorizedAccess);
    }
    // `cli` remains needed for the external parent `Team` load.
    let cfg = crate::common::CommonConfig::default();
    let cli = cfg.dynamodb();

    let app = find_application_for_child(&team.partition(), &application_id).await?;
    if app.status != SubTeamApplicationStatus::Returned {
        return Err(SubTeamError::ApplicationStateMismatch.into());
    }
    let parent_pk = app.parent_partition();
    let parent_uuid = match &parent_pk {
        Partition::Team(id) => Uuid::parse_str(id).map_err(|_| SubTeamError::ParentNotEligible)?,
        _ => return Err(SubTeamError::ParentNotEligible.into()),
    };
    let parent = Team::get_by_id(parent_uuid)
        .await
        .map_err(|e| {
            crate::error!("update_child_application parent load failed: {e}");
            SubTeamError::ParentNotEligible
        })?
        .ok_or(SubTeamError::ParentNotEligible)?;

    let form_values = body
        .form_values
        .clone()
        .unwrap_or_else(|| app.form_values.0.clone());
    let doc_agreements = body.doc_agreements.clone();

    let member_count = count_team_members(cli, &team.partition()).await.map_err(|e| {
        crate::error!("member count failed: {e}");
        Error::from(SubTeamError::MemberCountBelowMinimum)
    })?;
    if member_count < parent.min_sub_team_members as i64 {
        return Err(SubTeamError::MemberCountBelowMinimum.into());
    }
    let now = crate::common::utils::time::get_now_timestamp_millis();
    if !meets_min_age(team.created_at, parent.min_sub_team_age_days, now) {
        return Err(SubTeamError::TeamAgeBelowMinimum.into());
    }

    let parent_form_fields = load_form_fields(&parent.partition()).await.map_err(|e| {
        crate::error!("form fields load failed: {e}");
        Error::from(SubTeamError::MissingRequiredFormField)
    })?;
    validate_form_values(&parent_form_fields, &form_values)?;

    // Doc agreements (delete old + insert new) + application update, all in one
    // Postgres transaction (was one DynamoDB transact_write_items).
    let tx = postgres::Tx::begin().await.map_err(|e| {
        crate::error!("update_child_application tx begin failed: {e}");
        Error::from(SubTeamError::ApplicationStateMismatch)
    })?;

    if let Some(new_agreements) = doc_agreements.as_ref() {
        let parent_docs = load_docs(&parent.partition()).await.map_err(|e| {
            crate::error!("docs load failed: {e}");
            Error::from(SubTeamError::MissingRequiredDocAgreement)
        })?;
        let agreed_docs = validate_doc_agreements(&parent_docs, new_agreements)?;

        // Remove old agreements, then create new.
        let old_agreements = SubTeamDocAgreement::list_by_application(&parent.partition(), &application_id)
            .await
            .unwrap_or_default();
        for old in old_agreements {
            SubTeamDocAgreement::repository()
                .with_tx(&tx)
                .delete(old.id)
                .await
                .map_err(|e| {
                    crate::error!("update_child_application agreement delete failed: {e}");
                    Error::from(SubTeamError::ApplicationStateMismatch)
                })?;
        }
        for (doc, hash) in agreed_docs {
            let agreement = SubTeamDocAgreement::new(
                parent.partition(),
                application_id.clone(),
                doc.id.to_string(),
                doc.title.clone(),
                hash,
                user.pk().to_string(),
            );
            SubTeamDocAgreement::repository()
                .with_tx(&tx)
                .insert(&agreement)
                .await
                .map_err(|e| {
                    crate::error!("update_child_application agreement insert failed: {e}");
                    Error::from(SubTeamError::ApplicationStateMismatch)
                })?;
        }
    }

    // Application update: back to Pending with submitted_at=now, clear reason.
    SubTeamApplication::repository()
        .with_tx(&tx)
        .update(
            app.id,
            SubTeamApplication::update()
                .status(SubTeamApplicationStatus::Pending)
                .submitted_at(now)
                .updated_at(now)
                .decision_reason(Option::<String>::None)
                .form_values(FormValues(form_values.clone())),
        )
        .await
        .map_err(|e| {
            crate::error!("update_child_application app update failed: {:?}", e);
            Error::from(SubTeamError::ApplicationStateMismatch)
        })?;

    tx.commit().await.map_err(|e| {
        crate::error!("update_child_application tx commit failed: {e}");
        Error::from(SubTeamError::ApplicationStateMismatch)
    })?;

    // Notify parent admins of resubmission.
    let parent_team_id = parent.id.to_string();
    let sub_team_id = team.id.to_string();
    notify_parent_of_submission(
        cli,
        &parent.partition(),
        &parent_team_id,
        &application_id,
        &sub_team_id,
        &team.display_name,
    )
    .await;

    let mut updated = app;
    updated.status = SubTeamApplicationStatus::Pending;
    updated.submitted_at = Some(now);
    updated.updated_at = now;
    updated.form_values = FormValues(form_values);
    updated.decision_reason = None;
    Ok(updated.into())
}

// ── POST /api/teams/:team_pk/parent/applications/:application_id/cancel ──
#[post("/api/teams/:team_pk/parent/applications/:application_id/cancel", user: crate::features::auth::User, team: Team, role: TeamRole)]
pub async fn cancel_child_application_handler(
    team_pk: TeamPartition,
    application_id: String,
) -> Result<SubTeamApplicationResponse> {
    let _ = team_pk;
    let _ = user;
    if !role.is_admin_or_owner() {
        return Err(Error::UnauthorizedAccess);
    }
    let app = find_application_for_child(&team.partition(), &application_id).await?;
    if !matches!(
        app.status,
        SubTeamApplicationStatus::Pending | SubTeamApplicationStatus::Returned
    ) {
        return Err(SubTeamError::ApplicationStateMismatch.into());
    }

    let now = crate::common::utils::time::get_now_timestamp_millis();

    // Application status (Postgres) then child pending-clear (Postgres).
    SubTeamApplication::repository()
        .update(
            app.id,
            SubTeamApplication::update()
                .status(SubTeamApplicationStatus::Cancelled)
                .decided_at(now)
                .updated_at(now),
        )
        .await
        .map_err(|e| {
            crate::error!("cancel_child_application app update failed: {:?}", e);
            Error::from(SubTeamError::ApplicationStateMismatch)
        })?;
    Team::repository()
        .update(
            team.id,
            Team::update().pending_parent_team_id(None).updated_at(now),
        )
        .await
        .map_err(|e| {
            crate::error!("cancel_child_application team update failed: {:?}", e);
            Error::from(SubTeamError::ApplicationStateMismatch)
        })?;

    let mut updated = app;
    updated.status = SubTeamApplicationStatus::Cancelled;
    updated.decided_at = Some(now);
    updated.updated_at = now;
    Ok(updated.into())
}

// Avoid triggering unused-import warnings when body type is only used above.
#[cfg(feature = "server")]
fn _unused_silencer() {
    let _ = ApplicationDecisionReasonRequest::default();
    let _ = ApplicationReturnCommentRequest::default();
}

// ── Helpers ────────────────────────────────────────────────────────

#[cfg(feature = "server")]
fn meets_min_age(created_at: i64, min_age_days: i32, now_ms: i64) -> bool {
    if min_age_days <= 0 {
        return true;
    }
    if created_at <= 0 {
        return false;
    }
    let age_days = ((now_ms - created_at) / 86_400_000).max(0);
    age_days >= min_age_days as i64
}

#[cfg(feature = "server")]
async fn load_form_fields(parent_pk: &Partition) -> Result<Vec<SubTeamFormField>> {
    SubTeamFormField::list_for_team(parent_pk).await
}

#[cfg(feature = "server")]
async fn load_docs(parent_pk: &Partition) -> Result<Vec<SubTeamDocument>> {
    SubTeamDocument::list_for_team(parent_pk).await
}

#[cfg(feature = "server")]
fn validate_form_values(
    fields: &[SubTeamFormField],
    values: &std::collections::HashMap<String, serde_json::Value>,
) -> Result<()> {
    for f in fields {
        if !f.required {
            continue;
        }
        let id = f.id.to_string();
        let Some(v) = values.get(&id) else {
            return Err(SubTeamError::MissingRequiredFormField.into());
        };
        if is_empty_value(v) {
            return Err(SubTeamError::MissingRequiredFormField.into());
        }
    }
    Ok(())
}

#[cfg(feature = "server")]
fn is_empty_value(v: &serde_json::Value) -> bool {
    match v {
        serde_json::Value::Null => true,
        serde_json::Value::String(s) => s.trim().is_empty(),
        serde_json::Value::Array(a) => a.is_empty(),
        serde_json::Value::Object(o) => o.is_empty(),
        _ => false,
    }
}

#[cfg(feature = "server")]
fn validate_doc_agreements(
    parent_docs: &[SubTeamDocument],
    agreements: &[crate::features::sub_team::types::DocAgreementInput],
) -> Result<Vec<(SubTeamDocument, String)>> {
    let mut out: Vec<(SubTeamDocument, String)> = Vec::new();
    for doc in parent_docs {
        if !doc.required {
            continue;
        }
        let doc_id = doc.id.to_string();
        let Some(ag) = agreements.iter().find(|a| a.doc_id == doc_id) else {
            return Err(SubTeamError::MissingRequiredDocAgreement.into());
        };
        if ag.body_hash != doc.body_hash {
            return Err(SubTeamError::DocAgreementStale.into());
        }
        out.push((doc.clone(), ag.body_hash.clone()));
    }
    Ok(out)
}

#[cfg(feature = "server")]
async fn has_in_flight_application(applicant_pk: &Partition) -> Result<bool> {
    let apps = SubTeamApplication::find_by_applicant_all(applicant_pk).await?;
    Ok(apps.iter().any(|a| {
        matches!(
            a.status,
            SubTeamApplicationStatus::Pending | SubTeamApplicationStatus::Returned
        )
    }))
}

/// Most recent Returned application under `applicant_pk` targeting
/// `parent_team_id`, if any.
#[cfg(feature = "server")]
async fn find_returned_application(
    applicant_pk: &Partition,
    parent_team_id: &str,
) -> Result<Option<SubTeamApplication>> {
    let apps = SubTeamApplication::find_by_applicant_all(applicant_pk).await?;
    Ok(apps.into_iter().find(|a| {
        matches!(a.status, SubTeamApplicationStatus::Returned) && a.parent_team_id == parent_team_id
    }))
}

#[cfg(feature = "server")]
async fn is_parent_already_sub_team_of_child(
    child_team_pk: &Partition,
    candidate_parent_pk: &Partition,
) -> Result<bool> {
    let candidate_id = match candidate_parent_pk {
        Partition::Team(id) => id.clone(),
        _ => return Ok(false),
    };
    let links = SubTeamLink::list_for_parent(child_team_pk).await?;
    Ok(links.iter().any(|link| link.child_team_id == candidate_id))
}

#[cfg(feature = "server")]
async fn find_latest_application(applicant_pk: &Partition) -> Result<Option<SubTeamApplication>> {
    let apps = SubTeamApplication::find_by_applicant_all(applicant_pk).await?;
    Ok(apps.into_iter().next())
}

#[cfg(feature = "server")]
async fn find_application_for_child(
    applicant_pk: &Partition,
    application_id: &str,
) -> Result<SubTeamApplication> {
    SubTeamApplication::find_in_applicant(applicant_pk, application_id)
        .await?
        .ok_or_else(|| SubTeamError::ApplicationNotFound.into())
}

// ── GET /api/parent-teams/:parent_team_pk/my-application ──────────
#[get(
    "/api/parent-teams/:parent_team_pk/my-application",
    user: crate::features::auth::User
)]
pub async fn find_my_application_for_parent_handler(
    parent_team_pk: TeamPartition,
) -> Result<Option<SubTeamApplicationResponse>> {
    let user_pk = user.pk();
    let parent_pk_full: Partition = parent_team_pk.clone().into();
    let parent_uuid = match &parent_pk_full {
        Partition::Team(id) => id.clone(),
        _ => return Ok(None),
    };

    // 1. Enumerate viewer's admin/owner teams.
    let user_teams = crate::features::auth::UserTeam::find_by_user(&user_pk)
        .await
        .map_err(|e| {
            crate::error!("find_my_application_for_parent UserTeam query failed: {e}");
            SubTeamError::ApplicationStateMismatch
        })?;

    // 2. For each admin team, walk its application history and find the first
    //    row whose parent matches. Return the freshest match overall.
    let mut best: Option<SubTeamApplication> = None;
    for ut in user_teams {
        if !ut.role.0.is_admin_or_owner() {
            continue;
        }
        let applicant_pk = match ut.team_pk.parse::<Partition>() {
            Ok(pk) => pk,
            Err(_) => continue,
        };
        let Ok(apps) = SubTeamApplication::find_by_applicant_all(&applicant_pk).await else {
            continue;
        };
        for app in apps {
            if app.parent_team_id != parent_uuid {
                continue;
            }
            // Skip applications that have no meaningful "status view".
            if matches!(
                app.status,
                SubTeamApplicationStatus::Draft | SubTeamApplicationStatus::Cancelled
            ) {
                continue;
            }
            let candidate_ts = app.submitted_at.unwrap_or(app.created_at);
            let beat = match &best {
                Some(b) => {
                    let b_ts = b.submitted_at.unwrap_or(b.created_at);
                    candidate_ts > b_ts
                }
                None => true,
            };
            if beat {
                best = Some(app);
            }
            break;
        }
    }

    let Some(app) = best else { return Ok(None) };

    // 3. Join the applicant + parent teams for display metadata.
    let applicant_partition = app.applicant_partition();
    let mut dto: SubTeamApplicationResponse = app.into();
    let applicant_uuid = match &applicant_partition {
        Partition::Team(id) => Uuid::parse_str(id).ok(),
        _ => None,
    };
    if let Some(applicant) = match applicant_uuid {
        Some(id) => Team::get_by_id(id).await.ok().flatten(),
        None => None,
    } {
        dto.applicant_team_display_name = applicant.display_name.clone();
        dto.applicant_team_username = applicant.username.clone();
    }
    if let Some(parent) = match Uuid::parse_str(&parent_uuid) {
        Ok(id) => Team::get_by_id(id).await.ok().flatten(),
        Err(_) => None,
    } {
        dto.parent_team_display_name = parent.display_name.clone();
        dto.parent_team_username = parent.username.clone();
    }
    Ok(Some(dto))
}
