use crate::common::*;
#[cfg(feature = "server")]
use crate::features::posts::models::Team;
use crate::features::social::pages::member::dto::TeamRole;
use crate::features::sub_team::models::{SubTeamFormField, SubTeamFormFieldType};
use crate::features::sub_team::types::{
    CreateSubTeamFormFieldRequest, ReorderFormFieldsRequest, SubTeamError, SubTeamFormFieldResponse,
    TeamProfileLink, UpdateSubTeamFormFieldRequest,
};
#[cfg(feature = "server")]
use crate::features::sub_team::models::json::StringList;
#[cfg(feature = "server")]
use postgres::PostgresEntity;

#[cfg(feature = "server")]
fn sort_fields(items: &mut [SubTeamFormField]) {
    // Locked defaults (팀 이름 / 설립 목적) always render before any custom
    // fields, regardless of their stored `order` value.
    items.sort_by(|a, b| {
        b.locked
            .cmp(&a.locked)
            .then(a.order.cmp(&b.order))
            .then(a.created_at.cmp(&b.created_at))
    });
}

// ── GET list ─────────────────────────────────────────────────────
//
// First-call seeding lays down two `locked: true` defaults — "팀 이름"
// and "설립 목적" — when the team's form is empty.
#[get("/api/teams/:team_pk/sub-teams/form-fields", user: crate::features::auth::User)]
pub async fn list_sub_team_form_fields_handler(
    team_pk: TeamPartition,
) -> Result<ListResponse<SubTeamFormFieldResponse>> {
    let _ = user;
    let parent_pk: Partition = team_pk.into();

    let mut items = SubTeamFormField::list_for_team(&parent_pk)
        .await
        .map_err(|e| {
            crate::error!("list_sub_team_form_fields query failed: {e}");
            SubTeamError::FormFieldNotFound
        })?;

    // Backfill any missing locked defaults — runs on every list call.
    let seeded = ensure_default_fields(&parent_pk, &items).await;
    items.extend(seeded);

    sort_fields(&mut items);
    let items: Vec<SubTeamFormFieldResponse> = items.into_iter().map(Into::into).collect();
    Ok((items, None).into())
}

#[cfg(feature = "server")]
async fn ensure_default_fields(
    parent_pk: &Partition,
    existing: &[SubTeamFormField],
) -> Vec<SubTeamFormField> {
    let defaults: [(&str, SubTeamFormFieldType, TeamProfileLink, i32); 2] = [
        (
            "제안하는 팀 이름",
            SubTeamFormFieldType::ShortText,
            TeamProfileLink::TeamName,
            0,
        ),
        (
            "설립 목적",
            SubTeamFormFieldType::LongText,
            TeamProfileLink::TeamBio,
            1,
        ),
    ];
    let mut out: Vec<SubTeamFormField> = Vec::new();
    for (label, field_type, link, order) in defaults {
        // Skip if a locked row with the same link already exists.
        if existing
            .iter()
            .any(|f| f.locked && f.linked_to == Some(link))
        {
            continue;
        }
        let field = SubTeamFormField::new_with_lock(
            parent_pk.clone(),
            label.to_string(),
            field_type,
            true,
            order,
            Vec::new(),
            Some(link),
            true,
        );
        if let Err(e) = SubTeamFormField::repository().insert(&field).await {
            crate::error!("ensure_default_fields create failed: {e}");
            continue;
        }
        out.push(field);
    }
    out
}

// ── POST create ─────────────────────────────────────────────────
#[post("/api/teams/:team_pk/sub-teams/form-fields", user: crate::features::auth::User, team: Team, role: TeamRole)]
pub async fn create_sub_team_form_field_handler(
    team_pk: TeamPartition,
    body: CreateSubTeamFormFieldRequest,
) -> Result<SubTeamFormFieldResponse> {
    let _ = team_pk;
    let _ = user;
    if !role.is_admin_or_owner() {
        return Err(Error::UnauthorizedAccess);
    }

    let order = body.order.unwrap_or(0);
    let options = body.options.unwrap_or_default();

    let field = SubTeamFormField::new(
        team.partition(),
        body.label,
        body.field_type,
        body.required,
        order,
        options,
        body.linked_to,
    );

    SubTeamFormField::repository().insert(&field).await.map_err(|e| {
        crate::error!("create_sub_team_form_field execute failed: {e}");
        SubTeamError::FormFieldNotFound
    })?;

    Ok(field.into())
}

// ── PATCH update ────────────────────────────────────────────────
#[patch("/api/teams/:team_pk/sub-teams/form-fields/:field_id", user: crate::features::auth::User, team: Team, role: TeamRole)]
pub async fn update_sub_team_form_field_handler(
    team_pk: TeamPartition,
    field_id: String,
    body: UpdateSubTeamFormFieldRequest,
) -> Result<SubTeamFormFieldResponse> {
    let _ = team_pk;
    let _ = user;
    if !role.is_admin_or_owner() {
        return Err(Error::UnauthorizedAccess);
    }

    let existing = SubTeamFormField::find_in_team(&team.partition(), &field_id)
        .await
        .map_err(|e| {
            crate::error!("update_sub_team_form_field get failed: {e}");
            SubTeamError::FormFieldNotFound
        })?
        .ok_or(SubTeamError::FormFieldNotFound)?;

    // Locked defaults are immutable from the admin form-builder.
    if existing.locked {
        return Err(Error::UnauthorizedAccess);
    }

    let mut updated = existing;
    let now = crate::common::utils::time::get_now_timestamp_millis();
    let mut upd = SubTeamFormField::update().updated_at(now);
    updated.updated_at = now;
    let mut changed = false;

    if let Some(label) = body.label {
        upd = upd.label(label.clone());
        updated.label = label;
        changed = true;
    }
    if let Some(field_type) = body.field_type {
        upd = upd.field_type(field_type);
        updated.field_type = field_type;
        changed = true;
    }
    if let Some(required) = body.required {
        upd = upd.required(required);
        updated.required = required;
        changed = true;
    }
    if let Some(order) = body.order {
        upd = upd.order(order);
        updated.order = order;
        changed = true;
    }
    if let Some(options) = body.options {
        upd = upd.options(StringList(options.clone()));
        updated.options = StringList(options);
        changed = true;
    }
    if let Some(linked_to) = body.linked_to {
        upd = upd.linked_to(Some(linked_to));
        updated.linked_to = Some(linked_to);
        changed = true;
    }

    if changed {
        SubTeamFormField::repository()
            .update(updated.id, upd)
            .await
            .map_err(|e| {
                crate::error!("update_sub_team_form_field execute failed: {e}");
                SubTeamError::FormFieldNotFound
            })?;
    }

    Ok(updated.into())
}

// ── DELETE ──────────────────────────────────────────────────────
#[delete("/api/teams/:team_pk/sub-teams/form-fields/:field_id", user: crate::features::auth::User, team: Team, role: TeamRole)]
pub async fn delete_sub_team_form_field_handler(
    team_pk: TeamPartition,
    field_id: String,
) -> Result<String> {
    let _ = team_pk;
    let _ = user;
    if !role.is_admin_or_owner() {
        return Err(Error::UnauthorizedAccess);
    }

    // Refuse to delete locked defaults.
    let existing = SubTeamFormField::find_in_team(&team.partition(), &field_id)
        .await
        .ok()
        .flatten();
    let Some(existing) = existing else {
        return Ok(String::new());
    };
    if existing.locked {
        return Err(Error::UnauthorizedAccess);
    }

    SubTeamFormField::repository()
        .delete(existing.id)
        .await
        .map_err(|e| {
            crate::error!("delete_sub_team_form_field execute failed: {e}");
            SubTeamError::FormFieldNotFound
        })?;

    Ok(String::new())
}

// ── POST reorder ────────────────────────────────────────────────
#[post("/api/teams/:team_pk/sub-teams/form-fields/reorder", user: crate::features::auth::User, team: Team, role: TeamRole)]
pub async fn reorder_sub_team_form_fields_handler(
    team_pk: TeamPartition,
    body: ReorderFormFieldsRequest,
) -> Result<String> {
    let _ = team_pk;
    let _ = user;
    if !role.is_admin_or_owner() {
        return Err(Error::UnauthorizedAccess);
    }

    let now = crate::common::utils::time::get_now_timestamp_millis();

    for (idx, field_id) in body.field_ids.iter().enumerate() {
        // Silently skip non-existent ids per spec.
        let existing = SubTeamFormField::find_in_team(&team.partition(), field_id)
            .await
            .ok()
            .flatten();
        let Some(existing) = existing else {
            continue;
        };
        let _ = SubTeamFormField::repository()
            .update(
                existing.id,
                SubTeamFormField::update().order(idx as i32).updated_at(now),
            )
            .await
            .map_err(|e| {
                crate::error!("reorder_sub_team_form_fields per-row failed: {e}");
                SubTeamError::FormFieldNotFound
            });
    }

    Ok(String::new())
}
