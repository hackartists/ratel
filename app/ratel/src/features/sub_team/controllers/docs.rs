use crate::common::*;
use crate::features::posts::models::Team;
use crate::features::social::pages::member::dto::TeamRole;
use crate::features::sub_team::models::{
    SubTeamDocument, SubTeamDocumentVersion, SUB_TEAM_DOCUMENT_MAX_BODY_BYTES,
};
use crate::features::sub_team::types::{
    CreateSubTeamDocumentRequest, ReorderDocumentsRequest, SubTeamDocumentResponse,
    SubTeamDocumentVersionResponse, SubTeamError, UpdateSubTeamDocumentRequest,
};
#[cfg(feature = "server")]
use crate::features::sub_team::models::json::FileList;
#[cfg(feature = "server")]
use postgres::PostgresEntity;

#[cfg(feature = "server")]
fn sort_docs(items: &mut [SubTeamDocument]) {
    items.sort_by(|a, b| a.order.cmp(&b.order).then(a.created_at.cmp(&b.created_at)));
}

// ── GET list (admin view) ───────────────────────────────────────
#[get("/api/teams/:team_pk/sub-teams/docs", user: crate::features::auth::User, team: Team, role: TeamRole)]
pub async fn list_sub_team_docs_handler(
    team_pk: TeamPartition,
) -> Result<ListResponse<SubTeamDocumentResponse>> {
    let _ = team_pk;
    let _ = user;
    if !role.is_admin_or_owner() {
        return Err(Error::UnauthorizedAccess);
    }

    let mut items = SubTeamDocument::list_for_team(&team.partition()).await.map_err(|e| {
        crate::error!("list_sub_team_docs query failed: {e}");
        SubTeamError::DocumentNotFound
    })?;
    sort_docs(&mut items);
    let items: Vec<SubTeamDocumentResponse> = items.into_iter().map(Into::into).collect();
    Ok((items, None).into())
}

// ── POST create ─────────────────────────────────────────────────
#[post("/api/teams/:team_pk/sub-teams/docs", user: crate::features::auth::User, team: Team, role: TeamRole)]
pub async fn create_sub_team_doc_handler(
    team_pk: TeamPartition,
    body: CreateSubTeamDocumentRequest,
) -> Result<SubTeamDocumentResponse> {
    let _ = team_pk;
    let _ = user;
    if !role.is_admin_or_owner() {
        return Err(Error::UnauthorizedAccess);
    }
    if body.body.as_bytes().len() > SUB_TEAM_DOCUMENT_MAX_BODY_BYTES {
        return Err(SubTeamError::DocumentBodyTooLarge.into());
    }

    let order = body.order.unwrap_or(0);
    let attachments = body.attachments.unwrap_or_default();

    let mut doc = SubTeamDocument::new(
        team.partition(),
        body.title.clone(),
        body.body.clone(),
        body.required,
        order,
        user.username.clone(),
        attachments.clone(),
    );

    // Bylaws / ClubBylaws docs are dual-written: the SubTeamDocument is the
    // canonical record, and a backing `Post` carries likes/comments.
    if let Some(cat) = body.category.as_ref() {
        let trimmed = cat.trim();
        if !trimmed.is_empty() {
            use crate::features::posts::models::pg_json::{FileVec, StringVec};
            use crate::features::posts::models::Post;
            use crate::features::posts::types::{Author, PostStatus, PostType, Visibility};
            doc.category = Some(trimmed.to_string());

            let mut backing_post = Post::new(
                doc.title.clone(),
                doc.body.clone(),
                PostType::Post,
                Author {
                    pk: team.partition(),
                    display_name: team.display_name.clone(),
                    profile_url: team.profile_url.clone(),
                    username: team.username.clone(),
                    user_type: crate::common::types::UserType::Team,
                },
            );
            backing_post.status = PostStatus::Published;
            backing_post.visibility = Some(Visibility::Public);
            backing_post.attachments = FileVec(attachments.clone());
            backing_post.categories = StringVec(vec![trimmed.to_string()]);

            if let Err(e) = backing_post.save().await {
                crate::error!("create_sub_team_doc backing post create failed: {e}");
                return Err(SubTeamError::DocumentNotFound.into());
            }
            // Stored as the full `"FEED#…"` partition string — matches what
            // `pages/bylaws/component.rs` parses back into a `Partition` for
            // navigation, and what `list_team_bylaws_handler` below matches
            // against.
            doc.backing_post_id = Some(Partition::Feed(backing_post.feed_id()).to_string());
        }
    }

    SubTeamDocument::repository().insert(&doc).await.map_err(|e| {
        crate::error!("create_sub_team_doc execute failed: {e}");
        SubTeamError::DocumentNotFound
    })?;

    // Immutable v1 snapshot. Best-effort — a failure doesn't roll the doc back.
    let snapshot = SubTeamDocumentVersion::snapshot_of(team.partition(), &doc);
    if let Err(e) = SubTeamDocumentVersion::repository().insert(&snapshot).await {
        crate::error!("create_sub_team_doc snapshot write failed: {e}");
    }

    Ok(doc.into())
}

// ── PATCH update ────────────────────────────────────────────────
#[patch("/api/teams/:team_pk/sub-teams/docs/:doc_id", user: crate::features::auth::User, team: Team, role: TeamRole)]
pub async fn update_sub_team_doc_handler(
    team_pk: TeamPartition,
    doc_id: String,
    body: UpdateSubTeamDocumentRequest,
) -> Result<SubTeamDocumentResponse> {
    let _ = team_pk;
    let _ = user;
    if !role.is_admin_or_owner() {
        return Err(Error::UnauthorizedAccess);
    }
    let mut existing = SubTeamDocument::find_in_team(&team.partition(), &doc_id)
        .await
        .map_err(|e| {
            crate::error!("update_sub_team_doc get failed: {e}");
            SubTeamError::DocumentNotFound
        })?
        .ok_or(SubTeamError::DocumentNotFound)?;

    // NOTE: `updated_at` is applied exactly once, at the end (`if changed`).
    // The Postgres UPDATE builder emits one `SET col = $n` per setter call and
    // rejects duplicates ("multiple assignments to same column"); the
    // DynamoDB-era code set `updated_at` here *and* again in the body branch,
    // which now errors. Track the timestamp on `existing` and apply it once.
    let now = crate::common::utils::time::get_now_timestamp_millis();
    let mut upd = SubTeamDocument::update();
    existing.updated_at = now;
    let mut changed = false;

    if let Some(title) = body.title {
        upd = upd.title(title.clone());
        existing.title = title;
        changed = true;
    }

    if let Some(new_body) = body.body {
        if new_body.as_bytes().len() > SUB_TEAM_DOCUMENT_MAX_BODY_BYTES {
            return Err(SubTeamError::DocumentBodyTooLarge.into());
        }
        // Model helper recomputes body_hash + updated_at (applied once below).
        existing.update_body(new_body.clone());
        upd = upd.body(new_body).body_hash(existing.body_hash.clone());
        changed = true;
    }

    if let Some(required) = body.required {
        upd = upd.required(required);
        existing.required = required;
        changed = true;
    }

    if let Some(order) = body.order {
        upd = upd.order(order);
        existing.order = order;
        changed = true;
    }

    let mut attachments_synced_to_post = false;
    if let Some(attachments) = body.attachments {
        upd = upd.attachments(FileList(attachments.clone()));
        existing.attachments = FileList(attachments);
        attachments_synced_to_post = true;
        changed = true;
    }

    if changed {
        // Bump version and stamp editor. `updated_at` is set exactly once here
        // (see the note at the top of this fn) — `existing.updated_at` already
        // reflects the change time (bumped by `update_body` when the body
        // changed, else `now`).
        let next_version = existing.version.max(1) + 1;
        let editor = user.username.clone();
        upd = upd
            .version(next_version)
            .editor_username(editor.clone())
            .updated_at(existing.updated_at);
        existing.version = next_version;
        existing.editor_username = editor;

        SubTeamDocument::repository()
            .update(existing.id, upd)
            .await
            .map_err(|e| {
                crate::error!("update_sub_team_doc execute failed: {e}");
                SubTeamError::DocumentNotFound
            })?;

        // Sync the new attachments onto the backing Post (separate table —
        // touches ONLY `attachments` via a targeted Postgres `UPDATE`).
        if attachments_synced_to_post {
            if let Some(backing_id) = existing.backing_post_id.as_ref() {
                let post_uuid = backing_id
                    .parse::<Partition>()
                    .ok()
                    .and_then(|p| match p {
                        Partition::Feed(id) => uuid::Uuid::parse_str(&id).ok(),
                        _ => None,
                    });
                if let Some(post_uuid) = post_uuid {
                    use crate::features::posts::models::{Post, pg_json::FileVec};
                    if let Err(e) = Post::repository()
                        .update(
                            post_uuid,
                            Post::update().attachments(FileVec(existing.attachments.0.clone())),
                        )
                        .await
                    {
                        crate::error!(
                            "update_sub_team_doc backing post attachments sync failed: {e}"
                        );
                    }
                }
            }
        }

        // Immutable snapshot at the new version. Best-effort.
        let snapshot = SubTeamDocumentVersion::snapshot_of(team.partition(), &existing);
        if let Err(e) = SubTeamDocumentVersion::repository().insert(&snapshot).await {
            crate::error!("update_sub_team_doc snapshot write failed: {e}");
        }
    }

    Ok(existing.into())
}

// ── DELETE ──────────────────────────────────────────────────────
#[delete("/api/teams/:team_pk/sub-teams/docs/:doc_id", user: crate::features::auth::User, team: Team, role: TeamRole)]
pub async fn delete_sub_team_doc_handler(team_pk: TeamPartition, doc_id: String) -> Result<String> {
    let _ = team_pk;
    let _ = user;
    if !role.is_admin_or_owner() {
        return Err(Error::UnauthorizedAccess);
    }

    // Load first so the delete stays scoped to the owning team.
    if let Some(existing) = SubTeamDocument::find_in_team(&team.partition(), &doc_id)
        .await
        .ok()
        .flatten()
    {
        SubTeamDocument::repository()
            .delete(existing.id)
            .await
            .map_err(|e| {
                crate::error!("delete_sub_team_doc execute failed: {e}");
                SubTeamError::DocumentNotFound
            })?;
    }

    // Cascade-remove every snapshot row for this doc. Best-effort.
    if let Err(e) = SubTeamDocumentVersion::delete_for_doc(&team.partition(), &doc_id).await {
        crate::error!("delete_sub_team_doc snapshot cleanup failed: {e}");
    }

    Ok(String::new())
}

// ── GET version history ─────────────────────────────────────────
#[get("/api/teams/:team_pk/sub-teams/docs/:doc_id/versions", user: crate::features::auth::User, team: Team, role: TeamRole)]
pub async fn list_sub_team_doc_versions_handler(
    team_pk: TeamPartition,
    doc_id: String,
) -> Result<ListResponse<SubTeamDocumentVersionResponse>> {
    let _ = team_pk;
    let _ = user;
    if !role.is_admin_or_owner() {
        return Err(Error::UnauthorizedAccess);
    }

    let mut items = SubTeamDocumentVersion::list_for_doc(&team.partition(), &doc_id)
        .await
        .map_err(|e| {
            crate::error!("list_sub_team_doc_versions query failed: {e}");
            SubTeamError::DocumentNotFound
        })?;
    // Highest version first — most recent at the top.
    items.sort_by(|a, b| b.version.cmp(&a.version));
    let items: Vec<SubTeamDocumentVersionResponse> = items.into_iter().map(Into::into).collect();
    Ok((items, None).into())
}

// ── POST reorder ────────────────────────────────────────────────
#[post("/api/teams/:team_pk/sub-teams/docs/reorder", user: crate::features::auth::User, team: Team, role: TeamRole)]
pub async fn reorder_sub_team_docs_handler(
    team_pk: TeamPartition,
    body: ReorderDocumentsRequest,
) -> Result<String> {
    let _ = team_pk;
    let _ = user;
    if !role.is_admin_or_owner() {
        return Err(Error::UnauthorizedAccess);
    }
    let now = crate::common::utils::time::get_now_timestamp_millis();

    for (idx, doc_id) in body.doc_ids.iter().enumerate() {
        let existing = SubTeamDocument::find_in_team(&team.partition(), doc_id)
            .await
            .ok()
            .flatten();
        let Some(existing) = existing else {
            continue;
        };
        let _ = SubTeamDocument::repository()
            .update(
                existing.id,
                SubTeamDocument::update().order(idx as i32).updated_at(now),
            )
            .await
            .map_err(|e| {
                crate::error!("reorder_sub_team_docs per-row failed: {e}");
                SubTeamError::DocumentNotFound
            });
    }

    Ok(String::new())
}

// ── GET public bylaws list (no admin gate) ───────────────────────
#[get(
    "/api/teams/:team_pk/sub-teams/bylaws?category",
    user: crate::features::auth::OptionalUser
)]
pub async fn list_team_bylaws_handler(
    team_pk: TeamPartition,
    category: Option<String>,
) -> Result<ListResponse<SubTeamDocumentResponse>> {
    let _ = user;
    let pk: Partition = team_pk.into();

    let mut items = SubTeamDocument::list_for_team(&pk).await.map_err(|e| {
        crate::error!("list_team_bylaws query failed: {e}");
        SubTeamError::DocumentNotFound
    })?;
    sort_docs(&mut items);

    let category_filter = category.as_deref().map(|c| c.trim().to_string());
    let filtered: Vec<SubTeamDocument> = items
        .into_iter()
        .filter(|d| match category_filter.as_deref() {
            Some(c) => d.category.as_deref() == Some(c),
            None => d.category.is_some(),
        })
        .collect();

    // Batch-get backing posts so likes/comments come from the canonical source.
    use crate::features::posts::models::Post;
    use std::collections::HashMap;
    let post_ids: Vec<uuid::Uuid> = filtered
        .iter()
        .filter_map(|d| {
            d.backing_post_id.as_ref().and_then(|s| match s.parse::<Partition>() {
                Ok(Partition::Feed(id)) => uuid::Uuid::parse_str(&id).ok(),
                _ => None,
            })
        })
        .collect();
    let engagement: HashMap<String, (i64, i64)> = if post_ids.is_empty() {
        HashMap::new()
    } else {
        Post::get_many(post_ids)
            .await
            .unwrap_or_default()
            .into_iter()
            .map(|p| (Partition::Feed(p.feed_id()).to_string(), (p.likes, p.comments)))
            .collect()
    };

    let items: Vec<SubTeamDocumentResponse> = filtered
        .into_iter()
        .map(|d| {
            let backing_key = d.backing_post_id.clone();
            let mut resp: SubTeamDocumentResponse = d.into();
            if let Some(key) = backing_key {
                if let Some((likes, comments)) = engagement.get(&key) {
                    resp.likes = *likes;
                    resp.comments = *comments;
                }
            }
            resp
        })
        .collect();
    Ok((items, None).into())
}
