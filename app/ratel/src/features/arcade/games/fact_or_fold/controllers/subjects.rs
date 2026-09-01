//! Admin subject CRUD endpoints for *Fact or Fold*.
//!
//! Surface mirrored from the design doc (PR1 in §"Scope & PR slicing"):
//!  - POST   /api/fact-or-fold/admin/subjects          create draft or scheduled
//!  - GET    /api/fact-or-fold/admin/subjects          list with status filter
//!  - GET    /api/fact-or-fold/admin/subjects/:id      single subject
//!  - PATCH  /api/fact-or-fold/admin/subjects/:id      edit (locked once Live)
//!  - DELETE /api/fact-or-fold/admin/subjects/:id      soft-delete
//!  - POST   /api/fact-or-fold/admin/subjects/:id/publish  schedule or publish-now
//!
//! All endpoints are gated by `AdminUser` — only the operator role per
//! roadmap §FR-39.

use crate::common::*;
use crate::features::arcade::games::fact_or_fold::types::*;

#[cfg(feature = "server")]
use crate::common::models::auth::AdminUser;
#[cfg(feature = "server")]
use crate::features::arcade::games::fact_or_fold::models::FactFoldSubject;

#[cfg(feature = "server")]
const PAGE_LIMIT: i32 = 50;

// ── Helpers ───────────────────────────────────────────────────────

#[cfg(feature = "server")]
fn validate_subject_fields(
    headline_text: &str,
    body_excerpt: &str,
    difficulty: i32,
    reveal_sources_len: usize,
) -> Result<()> {
    if headline_text.trim().is_empty() || headline_text.len() > HEADLINE_TEXT_MAX {
        return Err(FactOrFoldError::SubjectInvalid.into());
    }
    let body_len = body_excerpt.chars().count();
    if body_excerpt.trim().is_empty() || body_len > HEADLINE_BODY_MAX {
        return Err(FactOrFoldError::SubjectInvalid.into());
    }
    if !(HEADLINE_DIFFICULTY_MIN..=HEADLINE_DIFFICULTY_MAX).contains(&difficulty) {
        return Err(FactOrFoldError::SubjectInvalid.into());
    }
    if reveal_sources_len > REVEAL_SOURCES_MAX {
        return Err(FactOrFoldError::SubjectInvalid.into());
    }
    Ok(())
}

#[cfg(feature = "server")]
fn validate_scheduled_at(scheduled_at: Option<i64>) -> Result<()> {
    if let Some(ts) = scheduled_at {
        let now = crate::common::utils::time::get_now_timestamp_millis();
        if ts < now {
            return Err(FactOrFoldError::PublishInvariantViolation.into());
        }
    }
    Ok(())
}

/// `expires_at` must be strictly after the window's start. We accept
/// `0` to keep legacy "indefinite" rows valid; any positive value
/// must be greater than `scheduled_at` (or `now`, whichever applies).
#[cfg(feature = "server")]
fn validate_expires_at(scheduled_at: Option<i64>, expires_at: i64) -> Result<()> {
    if expires_at == 0 {
        return Ok(());
    }
    let now = crate::common::utils::time::get_now_timestamp_millis();
    let start = scheduled_at.unwrap_or(now);
    if expires_at <= start {
        return Err(FactOrFoldError::PublishInvariantViolation.into());
    }
    Ok(())
}

#[cfg(feature = "server")]
fn to_response(row: FactFoldSubject) -> SubjectResponse {
    SubjectResponse {
        id: FactFoldSubjectEntityType(row.subject_id.clone()),
        status: row.status,
        headline_text: row.headline_text,
        body_excerpt: row.body_excerpt,
        verdict: row.verdict,
        difficulty: row.difficulty,
        category_tags: row.category_tags.0,
        source_label: row.source_label,
        insider_statement: row.insider_statement,
        reveal_summary: row.reveal_summary,
        reveal_sources: row.reveal_sources.0,
        scheduled_at: row.scheduled_at,
        expires_at: row.expires_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
    }
}

// ── POST /api/fact-or-fold/admin/subjects ───────────────────────

#[post("/api/fact-or-fold/admin/subjects", user: AdminUser)]
pub async fn create_subject_handler(
    req: CreateSubjectRequest,
) -> Result<SubjectResponse> {
    validate_subject_fields(
        &req.headline_text,
        &req.body_excerpt,
        req.difficulty,
        req.reveal_sources.len(),
    )?;
    validate_scheduled_at(req.scheduled_at)?;
    validate_expires_at(req.scheduled_at, req.expires_at)?;

    if req.insider_statement.trim().is_empty() || req.source_label.trim().is_empty() {
        return Err(FactOrFoldError::SubjectInvalid.into());
    }

    let subject_id = uuid::Uuid::now_v7().to_string();
    let row = FactFoldSubject::new_draft(
        subject_id,
        user.pk().clone(),
        req.headline_text,
        req.body_excerpt,
        req.verdict,
        req.difficulty,
        req.category_tags,
        req.source_label,
        req.insider_statement,
        req.reveal_summary,
        req.reveal_sources,
        req.scheduled_at,
        req.expires_at,
    );

    row.insert_new().await.map_err(|e| {
        crate::error!("create_subject_handler create failed: {e}");
        FactOrFoldError::StorageFailure
    })?;

    Ok(to_response(row))
}

// ── GET /api/fact-or-fold/admin/subjects ────────────────────────

#[get("/api/fact-or-fold/admin/subjects?bookmark&status", _user: AdminUser)]
pub async fn list_subjects_handler(
    bookmark: Option<String>,
    status: Option<SubjectStatus>,
) -> Result<ListResponse<SubjectResponse>> {
    // Offset-based pagination replaces the DynamoDB LEK bookmark;
    // `bookmark` carries the next row offset. `status` filters at the
    // DB level; a `None` status excludes soft-deleted rows and orders
    // newest-first (matching the prior in-memory sort).
    let offset: i64 = bookmark
        .as_deref()
        .and_then(|b| b.parse::<i64>().ok())
        .unwrap_or(0)
        .max(0);
    let exclude_deleted = status.is_none();
    let rows = FactFoldSubject::list_page(status, exclude_deleted, PAGE_LIMIT as i64, offset)
        .await
        .map_err(|e| {
            crate::error!("list_subjects_handler query failed: {e}");
            FactOrFoldError::StorageFailure
        })?;

    let next = if rows.len() as i32 == PAGE_LIMIT {
        Some((offset + PAGE_LIMIT as i64).to_string())
    } else {
        None
    };

    let responses: Vec<SubjectResponse> = rows.into_iter().map(to_response).collect();
    Ok((responses, next).into())
}

// ── GET /api/fact-or-fold/admin/subjects/{subject_id} ───────────

#[get("/api/fact-or-fold/admin/subjects/{subject_id}", _user: AdminUser)]
pub async fn get_subject_handler(
    subject_id: FactFoldSubjectEntityType,
) -> Result<SubjectResponse> {
    let row = FactFoldSubject::get_by_subject_id(&subject_id.0)
        .await
        .map_err(|e| {
            crate::error!("get_subject_handler get failed: {e}");
            FactOrFoldError::StorageFailure
        })?
        .ok_or(FactOrFoldError::SubjectNotFound)?;

    Ok(to_response(row))
}

// ── PATCH /api/fact-or-fold/admin/subjects/{subject_id} ─────────

#[patch("/api/fact-or-fold/admin/subjects/{subject_id}", _user: AdminUser)]
pub async fn update_subject_handler(
    subject_id: FactFoldSubjectEntityType,
    req: UpdateSubjectRequest,
) -> Result<SubjectResponse> {
    let mut existing = FactFoldSubject::get_by_subject_id(&subject_id.0)
        .await
        .map_err(|e| {
            crate::error!("update_subject_handler get failed: {e}");
            FactOrFoldError::StorageFailure
        })?
        .ok_or(FactOrFoldError::SubjectNotFound)?;

    let locked = existing.is_locked();

    if locked {
        // Once a round is Live or Settled, only reveal_sources may grow
        // (roadmap §FR-43). Any other field change is rejected.
        let only_reveal_sources_change = req.headline_text.is_none()
            && req.body_excerpt.is_none()
            && req.verdict.is_none()
            && req.difficulty.is_none()
            && req.category_tags.is_none()
            && req.source_label.is_none()
            && req.insider_statement.is_none()
            && req.reveal_summary.is_none()
            && req.scheduled_at.is_none()
            && req.expires_at.is_none();
        if !only_reveal_sources_change {
            return Err(FactOrFoldError::SubjectLocked.into());
        }
    }

    if let Some(ts) = req.scheduled_at {
        validate_scheduled_at(Some(ts))?;
    }
    if let Some(exp) = req.expires_at {
        let start = req.scheduled_at.or(existing.scheduled_at);
        validate_expires_at(start, exp)?;
    }

    let now = crate::common::utils::time::get_now_timestamp_millis();
    existing.updated_at = now;
    let mut changed = false;

    if let Some(v) = req.headline_text {
        if v.trim().is_empty() || v.len() > HEADLINE_TEXT_MAX {
            return Err(FactOrFoldError::SubjectInvalid.into());
        }
        existing.headline_text = v;
        changed = true;
    }
    if let Some(v) = req.body_excerpt {
        let body_len = v.chars().count();
        if v.trim().is_empty() || body_len > HEADLINE_BODY_MAX {
            return Err(FactOrFoldError::SubjectInvalid.into());
        }
        existing.body_excerpt = v;
        changed = true;
    }
    if let Some(v) = req.verdict {
        existing.verdict = v;
        changed = true;
    }
    if let Some(v) = req.difficulty {
        if !(HEADLINE_DIFFICULTY_MIN..=HEADLINE_DIFFICULTY_MAX).contains(&v) {
            return Err(FactOrFoldError::SubjectInvalid.into());
        }
        existing.difficulty = v;
        changed = true;
    }
    if let Some(v) = req.category_tags {
        existing.category_tags = crate::features::arcade::games::fact_or_fold::models::CategoryTagList(v);
        changed = true;
    }
    if let Some(v) = req.source_label {
        if v.trim().is_empty() {
            return Err(FactOrFoldError::SubjectInvalid.into());
        }
        existing.source_label = v;
        changed = true;
    }
    if let Some(v) = req.insider_statement {
        if v.trim().is_empty() {
            return Err(FactOrFoldError::SubjectInvalid.into());
        }
        existing.insider_statement = v;
        changed = true;
    }
    if let Some(v) = req.reveal_summary {
        existing.reveal_summary = v;
        changed = true;
    }
    if let Some(v) = req.reveal_sources {
        if v.len() > REVEAL_SOURCES_MAX {
            return Err(FactOrFoldError::SubjectInvalid.into());
        }
        existing.reveal_sources = crate::features::arcade::games::fact_or_fold::models::RevealSourceList(v);
        changed = true;
    }
    if let Some(v) = req.scheduled_at {
        existing.scheduled_at = Some(v);
        existing.pick_at = v;
        if matches!(existing.status, SubjectStatus::Draft) {
            existing.status = SubjectStatus::Scheduled;
        }
        changed = true;
    }
    if let Some(v) = req.expires_at {
        existing.expires_at = v;
        changed = true;
    }

    if changed {
        existing.save().await.map_err(|e| {
            crate::error!("update_subject_handler execute failed: {e}");
            FactOrFoldError::StorageFailure
        })?;
    }

    Ok(to_response(existing))
}

// ── DELETE /api/fact-or-fold/admin/subjects/{subject_id} ────────

#[delete("/api/fact-or-fold/admin/subjects/{subject_id}", _user: AdminUser)]
pub async fn delete_subject_handler(
    subject_id: FactFoldSubjectEntityType,
) -> Result<SubjectResponse> {
    let mut existing = FactFoldSubject::get_by_subject_id(&subject_id.0)
        .await
        .map_err(|e| {
            crate::error!("delete_subject_handler get failed: {e}");
            FactOrFoldError::StorageFailure
        })?
        .ok_or(FactOrFoldError::SubjectNotFound)?;

    if existing.is_locked() {
        return Err(FactOrFoldError::SubjectLocked.into());
    }

    let now = crate::common::utils::time::get_now_timestamp_millis();
    existing.status = SubjectStatus::Deleted;
    existing.updated_at = now;
    existing.save().await.map_err(|e| {
        crate::error!("delete_subject_handler execute failed: {e}");
        FactOrFoldError::StorageFailure
    })?;

    Ok(to_response(existing))
}

// ── POST /api/fact-or-fold/admin/subjects/{subject_id}/publish ──

/// Drafts must satisfy the full validation (insider statement, body
/// length, sources) before they can leave Draft. Mode (schedule vs
/// publish-now) is encoded in `PublishSubjectRequest::scheduled_at`.
#[post("/api/fact-or-fold/admin/subjects/{subject_id}/publish", _user: AdminUser)]
pub async fn publish_subject_handler(
    subject_id: FactFoldSubjectEntityType,
    req: PublishSubjectRequest,
) -> Result<SubjectResponse> {
    let mut existing = FactFoldSubject::get_by_subject_id(&subject_id.0)
        .await
        .map_err(|e| {
            crate::error!("publish_subject_handler get failed: {e}");
            FactOrFoldError::StorageFailure
        })?
        .ok_or(FactOrFoldError::SubjectNotFound)?;

    if existing.is_locked() {
        return Err(FactOrFoldError::SubjectLocked.into());
    }

    validate_subject_fields(
        &existing.headline_text,
        &existing.body_excerpt,
        existing.difficulty,
        existing.reveal_sources.len(),
    )
    .map_err(|_| FactOrFoldError::PublishInvariantViolation)?;

    if existing.insider_statement.trim().is_empty()
        || existing.source_label.trim().is_empty()
        || existing.reveal_summary.trim().is_empty()
    {
        return Err(FactOrFoldError::PublishInvariantViolation.into());
    }

    let now = crate::common::utils::time::get_now_timestamp_millis();
    let (next_status, next_scheduled_at, next_pick_at) = match req.scheduled_at {
        Some(ts) => {
            if ts < now {
                return Err(FactOrFoldError::PublishInvariantViolation.into());
            }
            // Scheduled → the row is pickable when its scheduled time
            // arrives, so the GSI3 sort key tracks `ts` directly.
            (SubjectStatus::Scheduled, Some(ts), ts)
        }
        // Publish-now → row enters Live with `pick_at = now` so its
        // FIFO slot reflects publish order.
        None => (SubjectStatus::Live, None, now),
    };

    let next_expires_at = req.expires_at.unwrap_or(existing.expires_at);
    if let Some(exp) = req.expires_at {
        validate_expires_at(next_scheduled_at, exp)?;
    }

    // Publish-now (`next_scheduled_at == None`) clears any prior
    // schedule so the row no longer surfaces in queue/upcoming queries.
    existing.status = next_status;
    existing.scheduled_at = next_scheduled_at;
    existing.pick_at = next_pick_at;
    existing.expires_at = next_expires_at;
    existing.updated_at = now;
    existing.save().await.map_err(|e| {
        crate::error!("publish_subject_handler execute failed: {e}");
        FactOrFoldError::StorageFailure
    })?;

    Ok(to_response(existing))
}
