//! `SubTeamApplicationDraft` CRUD — lets the applicant save the form
//! state mid-flight and resume later. The row is keyed by
//! (applicant_team_pk, parent_team_id) so one applicant can hold one
//! draft per parent team they're considering.

use crate::common::*;
use crate::features::posts::models::Team;
use crate::features::social::pages::member::dto::TeamRole;
use crate::features::sub_team::models::{DocAgreementSnapshot, SubTeamApplicationDraft};
use crate::features::sub_team::types::{
    ApplicationDraftResponse, DocAgreementInput, SaveApplicationDraftRequest, SubTeamError,
};

// ── PUT /api/teams/:team_pk/sub-teams/application-draft ─────────
// `team_pk` is the **applicant** team.
#[post("/api/teams/:team_pk/sub-teams/application-draft", user: crate::features::auth::User, team: Team, role: TeamRole)]
pub async fn save_sub_team_application_draft_handler(
    team_pk: TeamPartition,
    body: SaveApplicationDraftRequest,
) -> Result<ApplicationDraftResponse> {
    let _ = team_pk;
    let _ = user;
    if !role.is_admin_or_owner() {
        return Err(Error::UnauthorizedAccess);
    }

    let agreements: Vec<DocAgreementSnapshot> = body
        .doc_agreements
        .into_iter()
        .map(|a| DocAgreementSnapshot {
            doc_id: a.doc_id,
            body_hash: a.body_hash,
        })
        .collect();

    let draft = SubTeamApplicationDraft::new(
        team.partition(),
        body.parent_team_id.clone(),
        body.form_values.clone(),
        agreements.clone(),
    );

    // Idempotent autosave — overwrites every tick (was DynamoEntity::upsert).
    draft.save().await.map_err(|e| {
        crate::error!("save_sub_team_application_draft upsert failed: {e}");
        SubTeamError::DraftOperationFailed
    })?;

    Ok(ApplicationDraftResponse {
        parent_team_id: draft.parent_team_id,
        form_values: draft.form_values.0,
        doc_agreements: agreements
            .into_iter()
            .map(|a| DocAgreementInput {
                doc_id: a.doc_id,
                body_hash: a.body_hash,
            })
            .collect(),
        updated_at: draft.updated_at,
    })
}

// ── GET /api/teams/:team_pk/sub-teams/application-draft/:parent_team_id ──
#[get("/api/teams/:team_pk/sub-teams/application-draft/:parent_team_id", user: crate::features::auth::User, team: Team)]
pub async fn get_sub_team_application_draft_handler(
    team_pk: TeamPartition,
    parent_team_id: String,
) -> Result<Option<ApplicationDraftResponse>> {
    let _ = team_pk;
    let _ = user;

    let row = SubTeamApplicationDraft::find_draft(&team.partition(), &parent_team_id)
        .await
        .map_err(|e| {
            crate::error!("get_sub_team_application_draft get failed: {e}");
            SubTeamError::DraftOperationFailed
        })?;

    Ok(row.map(|d| ApplicationDraftResponse {
        parent_team_id: d.parent_team_id,
        form_values: d.form_values.0,
        doc_agreements: d
            .doc_agreements
            .0
            .into_iter()
            .map(|a| DocAgreementInput {
                doc_id: a.doc_id,
                body_hash: a.body_hash,
            })
            .collect(),
        updated_at: d.updated_at,
    }))
}

// ── DELETE /api/teams/:team_pk/sub-teams/application-draft/:parent_team_id
#[delete("/api/teams/:team_pk/sub-teams/application-draft/:parent_team_id", user: crate::features::auth::User, team: Team)]
pub async fn delete_sub_team_application_draft_handler(
    team_pk: TeamPartition,
    parent_team_id: String,
) -> Result<String> {
    let _ = team_pk;
    let _ = user;

    SubTeamApplicationDraft::delete_draft(&team.partition(), &parent_team_id)
        .await
        .map_err(|e| {
            crate::error!("delete_sub_team_application_draft execute failed: {e}");
            SubTeamError::DraftOperationFailed
        })?;
    Ok(String::new())
}
