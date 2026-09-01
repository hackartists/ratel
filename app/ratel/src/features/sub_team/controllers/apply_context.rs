use crate::common::*;
use crate::features::sub_team::types::{
    ApplyContextDocument, ApplyContextResponse, SubTeamError, SubTeamFormFieldResponse,
};

#[cfg(feature = "server")]
use crate::features::posts::models::Team;
#[cfg(feature = "server")]
use crate::features::sub_team::models::{
    SubTeamApplication, SubTeamApplicationStatus, SubTeamDocument, SubTeamFormField, SubTeamLink,
};

#[get("/api/teams/:team_pk/sub-teams/apply-context")]
pub async fn get_sub_team_apply_context_handler(
    team_pk: TeamPartition,
) -> Result<ApplyContextResponse> {
    let parent_pk: Partition = team_pk.into();
    let parent_uuid = match &parent_pk {
        Partition::Team(id) => uuid::Uuid::parse_str(id).map_err(|_| SubTeamError::ParentNotEligible)?,
        _ => return Err(SubTeamError::ParentNotEligible.into()),
    };

    // 1. Load parent team for settings flags.
    let team = Team::get_by_id(parent_uuid)
        .await
        .map_err(|e| {
            crate::error!("apply_context team load failed: {e}");
            SubTeamError::ApplicationStateMismatch
        })?
        .ok_or(SubTeamError::ParentNotEligible)?;

    // 2. Form fields (ordered by order ASC then created_at ASC).
    let mut fields = SubTeamFormField::list_for_team(&parent_pk)
        .await
        .map_err(|e| {
            crate::error!("apply_context form fields query failed: {e}");
            SubTeamError::FormFieldNotFound
        })?;
    // Locked defaults always render at the top of the apply form.
    fields.sort_by(|a, b| {
        b.locked
            .cmp(&a.locked)
            .then(a.order.cmp(&b.order))
            .then(a.created_at.cmp(&b.created_at))
    });
    let form_fields: Vec<SubTeamFormFieldResponse> = fields.into_iter().map(Into::into).collect();

    // 3. All parent docs — required ones must be agreed before submit.
    let mut docs = SubTeamDocument::list_for_team(&parent_pk).await.map_err(|e| {
        crate::error!("apply_context docs query failed: {e}");
        SubTeamError::DocumentNotFound
    })?;
    docs.sort_by(|a, b| {
        b.required
            .cmp(&a.required)
            .then(a.order.cmp(&b.order))
            .then(a.created_at.cmp(&b.created_at))
    });
    let required_docs: Vec<ApplyContextDocument> = docs.into_iter().map(Into::into).collect();

    // 4. Recognized count — SubTeamLink rows under parent pk.
    let recognized_count = count_links(&parent_pk).await.map_err(|e| {
        crate::error!("apply_context recognized count failed: {e}");
        SubTeamError::ApplicationStateMismatch
    })?;

    // 5. Pending count — SubTeamApplication rows whose status is Pending.
    let pending_count = count_pending_applications(&parent_pk).await.map_err(|e| {
        crate::error!("apply_context pending count failed: {e}");
        SubTeamError::ApplicationStateMismatch
    })?;

    Ok(ApplyContextResponse {
        is_parent_eligible: team.is_parent_eligible,
        min_sub_team_members: team.min_sub_team_members,
        min_sub_team_age_days: team.min_sub_team_age_days,
        recognized_count,
        pending_count,
        form_fields,
        required_docs,
    })
}

#[cfg(feature = "server")]
async fn count_links(parent_pk: &Partition) -> Result<i64> {
    Ok(SubTeamLink::list_for_parent(parent_pk).await?.len() as i64)
}

#[cfg(feature = "server")]
async fn count_pending_applications(parent_pk: &Partition) -> Result<i64> {
    let items = SubTeamApplication::find_by_parent_all(parent_pk).await?;
    let count = items
        .iter()
        .filter(|a| a.status == SubTeamApplicationStatus::Pending)
        .count() as i64;
    Ok(count)
}
