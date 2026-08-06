use crate::common::*;
use crate::features::posts::models::Team;
use crate::features::social::pages::member::dto::TeamRole;
use crate::features::sub_team::models::SubTeamAnnouncementStatus;
use crate::features::sub_team::types::{
    CreateSubTeamAnnouncementRequest, SubTeamAnnouncementResponse, SubTeamError,
    UpdateSubTeamAnnouncementRequest,
};

#[cfg(feature = "server")]
use crate::features::sub_team::models::json::{FileList, SpaceTypeOpt, StringList};
#[cfg(feature = "server")]
use crate::features::sub_team::models::SubTeamAnnouncement;
#[cfg(feature = "server")]
use crate::features::sub_team::services::announcement_fanout::{
    count_recognized_sub_teams, MAX_RECOGNIZED_SUB_TEAMS,
};
#[cfg(feature = "server")]
use postgres::PostgresEntity;

#[cfg(feature = "server")]
const PAGE_LIMIT: i64 = 50;

// ── GET /api/teams/:team_pk/sub-teams/announcements ─────────────────
#[get("/api/teams/:team_pk/sub-teams/announcements?bookmark&status", user: crate::features::auth::User, team: Team, role: TeamRole)]
pub async fn list_announcements_handler(
    team_pk: TeamPartition,
    bookmark: Option<String>,
    status: Option<SubTeamAnnouncementStatus>,
) -> Result<ListResponse<SubTeamAnnouncementResponse>> {
    let _ = team_pk;
    let _ = user;
    if !role.is_admin_or_owner() {
        return Err(Error::UnauthorizedAccess);
    }
    let page = crate::features::sub_team::services::bookmark_to_page(&bookmark);
    let result = SubTeamAnnouncement::page_for_team(&team.partition(), page, PAGE_LIMIT)
        .await
        .map_err(|e| {
            crate::error!("list_announcements query failed: {e}");
            SubTeamError::AnnouncementNotFound
        })?;
    let next = crate::features::sub_team::services::next_bookmark(result.page, result.total_pages);

    // Default: exclude Deleted. If a specific status is requested, return only
    // rows matching that status. Newest first.
    let mut items: Vec<_> = result
        .items
        .into_iter()
        .filter(|a| match status {
            Some(s) => a.status == s,
            None => !matches!(a.status, SubTeamAnnouncementStatus::Deleted),
        })
        .collect();
    items.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    // Comments aggregate: each announcement's anchor Post lives at
    // `Partition::Feed(announcement_id)`. Batch-get them all and map
    // pk → comments.
    use crate::features::posts::models::Post;
    use std::collections::HashMap;
    let anchor_ids: Vec<uuid::Uuid> = items
        .iter()
        .filter(|a| matches!(a.status, SubTeamAnnouncementStatus::Published))
        .filter_map(|a| uuid::Uuid::parse_str(&a.announcement_id).ok())
        .collect();
    let comment_counts: HashMap<String, i64> = if anchor_ids.is_empty() {
        HashMap::new()
    } else {
        Post::get_many(anchor_ids)
            .await
            .unwrap_or_default()
            .into_iter()
            .map(|p| (Partition::Feed(p.feed_id()).to_string(), p.comments))
            .collect()
    };

    let items: Vec<SubTeamAnnouncementResponse> = items
        .into_iter()
        .map(|a| {
            let pk_key = Partition::Feed(a.announcement_id.clone()).to_string();
            let mut resp: SubTeamAnnouncementResponse = a.into();
            if let Some(c) = comment_counts.get(&pk_key) {
                resp.comments_count = (*c) as i32;
            }
            resp
        })
        .collect();
    Ok((items, next).into())
}

// ── GET /api/teams/:team_pk/sub-teams/announcements/:announcement_id ─
#[get("/api/teams/:team_pk/sub-teams/announcements/:announcement_id", user: crate::features::auth::User, team: Team, role: TeamRole)]
pub async fn get_announcement_handler(
    team_pk: TeamPartition,
    announcement_id: String,
) -> Result<SubTeamAnnouncementResponse> {
    let _ = team_pk;
    let _ = user;
    if !role.is_admin_or_owner() {
        return Err(Error::UnauthorizedAccess);
    }
    let ann = SubTeamAnnouncement::find_in_team(&team.partition(), &announcement_id)
        .await
        .map_err(|e| {
            crate::error!("get_announcement get failed: {e}");
            SubTeamError::AnnouncementNotFound
        })?
        .ok_or(SubTeamError::AnnouncementNotFound)?;
    let mut resp: SubTeamAnnouncementResponse = ann.clone().into();
    // Anchor Post lives at Feed(announcement_id); pull its comment count.
    if matches!(ann.status, SubTeamAnnouncementStatus::Published) {
        if let Ok(anchor_uuid) = uuid::Uuid::parse_str(&ann.announcement_id) {
            if let Ok(Some(p)) =
                crate::features::posts::models::Post::get_by_feed_id(anchor_uuid).await
            {
                resp.comments_count = p.comments as i32;
            }
        }
    }
    Ok(resp)
}

// ── POST /api/teams/:team_pk/sub-teams/announcements ────────────────
#[post("/api/teams/:team_pk/sub-teams/announcements", user: crate::features::auth::User, team: Team, role: TeamRole)]
pub async fn create_announcement_handler(
    team_pk: TeamPartition,
    body: CreateSubTeamAnnouncementRequest,
) -> Result<SubTeamAnnouncementResponse> {
    let _ = team_pk;
    if !role.is_admin_or_owner() {
        return Err(Error::UnauthorizedAccess);
    }

    // Direct-message draft: verify the target is a recognized sub-team.
    if let Some(target) = &body.target_child_team_id {
        let link = crate::features::sub_team::models::SubTeamLink::find_link(&team.partition(), &target.0)
            .await
            .map_err(|e| {
                crate::error!("create_announcement target link lookup failed: {e}");
                SubTeamError::SubTeamLinkNotFound
            })?;
        if link.is_none() {
            return Err(SubTeamError::SubTeamLinkNotFound.into());
        }
    }

    let mut ann = SubTeamAnnouncement::new_draft(
        team.partition(),
        body.title,
        body.body,
        user.pk().to_string(),
        body.target_child_team_id,
    );
    ann.html_contents = body.html_contents;
    ann.tags = StringList(body.tags);
    ann.attachments = FileList(body.attachments);
    ann.space_enabled = body.space_enabled;
    ann.space_type = SpaceTypeOpt(body.space_type);
    SubTeamAnnouncement::repository().insert(&ann).await.map_err(|e| {
        crate::error!("create_announcement create failed: {e}");
        SubTeamError::AnnouncementPublishFailed
    })?;

    Ok(ann.into())
}

// ── PATCH /api/teams/:team_pk/sub-teams/announcements/:announcement_id ─
#[patch("/api/teams/:team_pk/sub-teams/announcements/:announcement_id", user: crate::features::auth::User, team: Team, role: TeamRole)]
pub async fn update_announcement_handler(
    team_pk: TeamPartition,
    announcement_id: String,
    body: UpdateSubTeamAnnouncementRequest,
) -> Result<SubTeamAnnouncementResponse> {
    let _ = team_pk;
    let _ = user;
    if !role.is_admin_or_owner() {
        return Err(Error::UnauthorizedAccess);
    }

    let mut existing = SubTeamAnnouncement::find_in_team(&team.partition(), &announcement_id)
        .await
        .map_err(|e| {
            crate::error!("update_announcement get failed: {e}");
            SubTeamError::AnnouncementNotFound
        })?
        .ok_or(SubTeamError::AnnouncementNotFound)?;

    if !matches!(existing.status, SubTeamAnnouncementStatus::Draft) {
        return Err(SubTeamError::AnnouncementNotInDraft.into());
    }

    let now = crate::common::utils::time::get_now_timestamp_millis();
    let mut upd = SubTeamAnnouncement::update().updated_at(now);
    existing.updated_at = now;
    let mut changed = false;

    if let Some(title) = body.title {
        upd = upd.title(title.clone());
        existing.title = title;
        changed = true;
    }

    if let Some(body_str) = body.body {
        upd = upd.body(body_str.clone());
        existing.body = body_str;
        changed = true;
    }

    if let Some(html) = body.html_contents {
        upd = upd.html_contents(html.clone());
        existing.html_contents = html;
        changed = true;
    }

    if let Some(tags) = body.tags {
        upd = upd.tags(StringList(tags.clone()));
        existing.tags = StringList(tags);
        changed = true;
    }

    if let Some(attachments) = body.attachments {
        upd = upd.attachments(FileList(attachments.clone()));
        existing.attachments = FileList(attachments);
        changed = true;
    }

    if let Some(se) = body.space_enabled {
        upd = upd.space_enabled(se);
        existing.space_enabled = se;
        changed = true;
    }

    if let Some(st) = body.space_type {
        upd = upd.space_type(SpaceTypeOpt(Some(st)));
        existing.space_type = SpaceTypeOpt(Some(st));
        changed = true;
    }

    if changed {
        SubTeamAnnouncement::repository()
            .update(existing.id, upd)
            .await
            .map_err(|e| {
                crate::error!("update_announcement execute failed: {e}");
                SubTeamError::AnnouncementPublishFailed
            })?;
    }

    Ok(existing.into())
}

// ── POST /api/teams/:team_pk/sub-teams/announcements/:announcement_id/publish ─
#[post("/api/teams/:team_pk/sub-teams/announcements/:announcement_id/publish", user: crate::features::auth::User, team: Team, role: TeamRole)]
pub async fn publish_announcement_handler(
    team_pk: TeamPartition,
    announcement_id: String,
) -> Result<SubTeamAnnouncementResponse> {
    let _ = team_pk;
    let _ = user;
    if !role.is_admin_or_owner() {
        return Err(Error::UnauthorizedAccess);
    }
    let mut existing = SubTeamAnnouncement::find_in_team(&team.partition(), &announcement_id)
        .await
        .map_err(|e| {
            crate::error!("publish_announcement get failed: {e}");
            SubTeamError::AnnouncementNotFound
        })?
        .ok_or(SubTeamError::AnnouncementNotFound)?;

    if !matches!(existing.status, SubTeamAnnouncementStatus::Draft) {
        return Err(SubTeamError::AnnouncementNotInDraft.into());
    }

    // Direct messages target exactly one sub-team and bypass the cap check.
    let is_direct = existing.target_child_team_id.is_some();
    if !is_direct {
        let count = count_recognized_sub_teams(&team.partition()).await?;
        if count > MAX_RECOGNIZED_SUB_TEAMS {
            return Err(SubTeamError::BroadcastTooManySubTeams.into());
        }
    } else if let Some(target_id) = existing.target_child_team_id.clone() {
        // Re-verify the link still exists at publish time.
        let link =
            crate::features::sub_team::models::SubTeamLink::find_link(&team.partition(), &target_id)
                .await
                .map_err(|e| {
                    crate::error!("publish_announcement direct link lookup failed: {e}");
                    SubTeamError::SubTeamLinkNotFound
                })?;
        if link.is_none() {
            return Err(SubTeamError::SubTeamLinkNotFound.into());
        }
    }

    let now = crate::common::utils::time::get_now_timestamp_millis();

    // Build the Space FIRST (if enabled) so the anchor Post can be created with
    // `space_pk` already populated.
    use crate::common::models::space::SpaceCommon;
    use crate::features::posts::models::pg_json::{AuthorTypeJson, FileVec, StringVec};
    use crate::features::posts::models::Post;
    use crate::features::posts::types::{Author, PostStatus, PostType, Visibility};

    let parent_team_id_str = team.id.to_string();
    let anchor_post_body = if !existing.html_contents.is_empty() {
        existing.html_contents.clone()
    } else {
        existing.body.clone()
    };

    let space: Option<SpaceCommon> = if existing.space_enabled && existing.space_pk.is_none() {
        Some(SpaceCommon::new(
            FeedPartition(existing.announcement_id.clone()),
            team.partition(),
            team.display_name.clone(),
            team.profile_url.clone(),
            team.username.clone(),
        ))
    } else {
        None
    };

    // Anchor `user_pk` decides which wall the Post surfaces on.
    let anchor_user_pk: Partition = match existing.target_child_team_id.clone() {
        Some(child_id) => Partition::Team(child_id),
        None => team.partition(),
    };

    // The anchor Post's own id MUST equal the announcement's id — later
    // lookups resolve it via `Partition::Feed(announcement_id)`.
    let anchor_post_id = uuid::Uuid::parse_str(&existing.announcement_id).map_err(|e| {
        crate::error!("publish_announcement: invalid announcement_id: {e}");
        SubTeamError::AnnouncementPublishFailed
    })?;

    let mut anchor_post = Post::new(
        existing.title.clone(),
        anchor_post_body,
        PostType::Post,
        Author {
            pk: team.partition(),
            display_name: team.display_name.clone(),
            profile_url: team.profile_url.clone(),
            username: team.username.clone(),
            user_type: crate::common::types::UserType::Team,
        },
    );
    anchor_post.id = anchor_post_id;
    anchor_post.created_at = now;
    anchor_post.updated_at = now;
    anchor_post.status = PostStatus::Published;
    anchor_post.visibility = Some(Visibility::Broadcast);
    anchor_post.user_pk = anchor_user_pk.to_string();
    anchor_post.author_type = AuthorTypeJson(crate::common::types::UserType::Team);
    anchor_post.space_pk = space.as_ref().map(|s| s.space_pk.clone());
    anchor_post.space_type = existing.space_type.0;
    anchor_post.attachments = FileVec(existing.attachments.0.clone());
    anchor_post.categories = StringVec(existing.tags.0.clone());
    anchor_post.announcement_id = Some(existing.announcement_id.clone());
    anchor_post.announcement_parent_team_id = Some(parent_team_id_str);
    anchor_post.pinned_as_announcement = !is_direct;

    if let Err(e) = anchor_post.save().await {
        crate::error!("publish_announcement: anchor post create failed: {e}");
        return Err(SubTeamError::AnnouncementPublishFailed.into());
    }

    if let Some(space) = space {
        let space_pk_str = space.space_pk.clone();
        if let Err(e) = space.save().await {
            crate::error!("publish_announcement: space create failed: {e}");
            return Err(SubTeamError::AnnouncementPublishFailed.into());
        }
        existing.space_pk = Some(space_pk_str);
    }

    let anchor_post_pk_str = Partition::Feed(existing.announcement_id.clone()).to_string();
    let mut upd = SubTeamAnnouncement::update()
        .status(SubTeamAnnouncementStatus::Published)
        .published_at(now)
        .updated_at(now);
    if let Some(space_pk) = existing.space_pk.clone() {
        upd = upd.space_pk(space_pk);
    }
    // Pre-populate `target_post_pk` on direct messages so the parent's history
    // row can deep-link without waiting for the stream-driven fanout.
    if is_direct {
        upd = upd.target_post_pk(anchor_post_pk_str.clone());
    }
    SubTeamAnnouncement::repository()
        .update(existing.id, upd)
        .await
        .map_err(|e| {
            crate::error!("publish_announcement execute failed: {e}");
            SubTeamError::AnnouncementPublishFailed
        })?;

    existing.status = SubTeamAnnouncementStatus::Published;
    existing.published_at = Some(now);
    existing.updated_at = now;
    if is_direct {
        existing.target_post_pk = Some(anchor_post_pk_str);
    }

    // Fan-out happens asynchronously via the stream poller / event pipe.

    Ok(existing.into())
}

// ── DELETE /api/teams/:team_pk/sub-teams/announcements/:announcement_id ─
#[delete("/api/teams/:team_pk/sub-teams/announcements/:announcement_id", user: crate::features::auth::User, team: Team, role: TeamRole)]
pub async fn delete_announcement_handler(
    team_pk: TeamPartition,
    announcement_id: String,
) -> Result<String> {
    let _ = team_pk;
    let _ = user;
    if !role.is_admin_or_owner() {
        return Err(Error::UnauthorizedAccess);
    }

    // Soft-delete — keep any already-fanned-out Posts intact.
    let existing = SubTeamAnnouncement::find_in_team(&team.partition(), &announcement_id)
        .await
        .map_err(|e| {
            crate::error!("delete_announcement get failed: {e}");
            SubTeamError::AnnouncementNotFound
        })?
        .ok_or(SubTeamError::AnnouncementNotFound)?;

    let now = crate::common::utils::time::get_now_timestamp_millis();
    SubTeamAnnouncement::repository()
        .update(
            existing.id,
            SubTeamAnnouncement::update()
                .status(SubTeamAnnouncementStatus::Deleted)
                .updated_at(now),
        )
        .await
        .map_err(|e| {
            crate::error!("delete_announcement execute failed: {e}");
            SubTeamError::AnnouncementPublishFailed
        })?;

    Ok(String::new())
}
