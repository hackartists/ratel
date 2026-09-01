use std::collections::HashSet;

use crate::common::*;
use crate::features::auth::UserTeam;
use crate::features::posts::models::{Team, TeamOwner};
use crate::features::sub_team::models::{
    SubTeamAnnouncement, SubTeamAnnouncementFanout, SubTeamAnnouncementStatus, SubTeamLink,
};
use crate::features::sub_team::types::SubTeamError;
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
use uuid::Uuid;

/// Phase 1 cap — anything beyond this returns BroadcastTooManySubTeams at
/// publish time, so we should never fan out to more than this here either.
pub const MAX_RECOGNIZED_SUB_TEAMS: usize = 50;

/// Parse a `Partition::Team(id)` into its `Uuid` — Postgres `Team`/`TeamOwner`
/// rows are keyed by the raw uuid, not the `"TEAM#…"` partition string.
fn team_uuid(team_pk: &Partition) -> Option<Uuid> {
    match team_pk {
        Partition::Team(id) => Uuid::parse_str(id).ok(),
        _ => None,
    }
}

/// Resolve every member user pk for a team (UserTeam rows + owner). Used for
/// fan-out inbox notifications.
pub async fn resolve_team_members(
    _cli: &aws_sdk_dynamodb::Client,
    team_pk: &Partition,
) -> Result<Vec<Partition>> {
    let mut user_pks: HashSet<String> = HashSet::new();

    if let Some(uuid) = team_uuid(team_pk) {
        if let Ok(Some(owner)) = TeamOwner::find_by_team(uuid).await {
            user_pks.insert(owner.user_pk.clone());
        }
    }

    let rows = UserTeam::find_by_team(team_pk).await?;
    for row in rows {
        user_pks.insert(row.user_pk.clone());
    }

    Ok(user_pks
        .into_iter()
        .filter_map(|s| s.parse::<Partition>().ok())
        .collect())
}

/// Count recognized sub-teams for a parent team (used for publish-time
/// validation against the 50-team cap).
pub async fn count_recognized_sub_teams(parent_pk: &Partition) -> Result<usize> {
    Ok(SubTeamLink::list_for_parent(parent_pk).await?.len())
}

/// List recognized sub-teams (bounded — cap enforced by caller).
pub async fn list_recognized_sub_teams(parent_pk: &Partition) -> Result<Vec<SubTeamLink>> {
    SubTeamLink::list_for_parent(parent_pk).await
}

/// Fan-out handler for an announcement that has just been flipped to Published.
/// Called from `EventBridgeEnvelope::proc` in deployed envs and directly from
/// `stream_handler` in local-dev, so it keeps the `cli` argument for the
/// external `Team` / `Post` / inbox writes.
pub async fn handle_announcement_published(
    cli: &aws_sdk_dynamodb::Client,
    announcement: SubTeamAnnouncement,
) -> Result<()> {
    if !matches!(announcement.status, SubTeamAnnouncementStatus::Published) {
        tracing::debug!(
            "handle_announcement_published: ignoring status={:?}",
            announcement.status
        );
        return Ok(());
    }
    // Idempotency — a re-entry after the fan_out_count write should no-op.
    if announcement.fan_out_count > 0 {
        tracing::debug!(
            "handle_announcement_published: already fanned out ({}), skipping",
            announcement.fan_out_count
        );
        return Ok(());
    }

    let parent_partition = announcement.team_partition();
    let parent_team_id = announcement.parent_team_id();
    if parent_team_id.is_empty() {
        crate::error!(
            "handle_announcement_published: unexpected pk variant: {:?}",
            announcement.team_pk
        );
        return Err(SubTeamError::AnnouncementPublishFailed.into());
    }

    // Load parent team once so the inbox notifications can quote its name.
    let parent_team_uuid = Uuid::parse_str(&parent_team_id)
        .map_err(|_| SubTeamError::AnnouncementPublishFailed)?;
    let parent_team = match Team::get_by_id(parent_team_uuid).await {
        Ok(Some(t)) => t,
        Ok(None) => {
            crate::error!("handle_announcement_published: parent team not found: {parent_team_id}");
            return Err(SubTeamError::AnnouncementPublishFailed.into());
        }
        Err(e) => {
            crate::error!("handle_announcement_published: parent team fetch: {e}");
            return Err(SubTeamError::AnnouncementPublishFailed.into());
        }
    };

    // Direct messages target a single recognized sub-team — verify the link
    // still exists. Broadcasts use the full recognized-sub-teams list.
    let links: Vec<SubTeamLink> = if let Some(target_id) = &announcement.target_child_team_id {
        match SubTeamLink::find_link(&parent_partition, target_id).await {
            Ok(Some(link)) => vec![link],
            Ok(None) => {
                tracing::warn!(
                    "[fanout] direct-message target {} is not (or no longer) a recognized \
                     sub-team of {}; skipping",
                    target_id,
                    parent_team_id,
                );
                return Ok(());
            }
            Err(e) => {
                crate::error!("[fanout] direct-message link lookup failed: {e}");
                return Err(SubTeamError::AnnouncementPublishFailed.into());
            }
        }
    } else {
        list_recognized_sub_teams(&parent_partition).await?
    };
    if links.len() > MAX_RECOGNIZED_SUB_TEAMS {
        crate::error!(
            "handle_announcement_published: {} > MAX_RECOGNIZED_SUB_TEAMS for parent {}",
            links.len(),
            parent_team_id
        );
        return Err(SubTeamError::BroadcastTooManySubTeams.into());
    }

    let now = crate::common::utils::time::get_now_timestamp_millis();
    let is_direct = announcement.target_child_team_id.is_some();
    let mut fan_out_count: i32 = 0;
    let anchor_post_pk = Partition::Feed(announcement.announcement_id.clone());
    let cta_url = build_post_detail_url(&anchor_post_pk);
    let post_id_display = announcement.announcement_id.clone();
    let defer_inbox = !is_direct && announcement.space_enabled && announcement.space_pk.is_some();

    for link in &links {
        let child_team_id = link.child_team_id.clone();
        let child_team_pk: Partition = Partition::Team(child_team_id.clone());

        // Broadcasts: write a marker so the wall query can union the anchor
        // Post into the child's feed. Direct messages bypass the marker.
        if !is_direct {
            let marker = SubTeamAnnouncementFanout::new(
                child_team_pk.clone(),
                announcement.announcement_id.clone(),
                parent_team_id.clone(),
                false,
                now,
            );
            if let Err(e) = SubTeamAnnouncementFanout::repository().insert(&marker).await {
                crate::error!(
                    "handle_announcement_published: marker create for child={} failed: {e}",
                    child_team_id
                );
                // Partial fan-out is acceptable per Phase 1 spec.
                continue;
            }
            fan_out_count += 1;
        } else {
            fan_out_count += 1;
        }

        if defer_inbox {
            continue;
        }

        // Notify every member of the child team.
        let members = resolve_team_members(cli, &child_team_pk)
            .await
            .unwrap_or_default();
        for u in members {
            let payload = InboxPayload::SubTeamAnnouncementReceived {
                parent_team_id: parent_team_id.clone(),
                parent_team_name: parent_team.display_name.clone(),
                announcement_id: announcement.announcement_id.clone(),
                title: announcement.title.clone(),
                post_id: post_id_display.clone(),
                post_pk: anchor_post_pk.to_string(),
                cta_url: cta_url.clone(),
            };
            if let Err(e) = crate::common::utils::inbox::create_inbox_row(u, payload).await {
                crate::error!("handle_announcement_published: inbox create failed: {e}");
            }
        }
    }

    let mut upd = SubTeamAnnouncement::update()
        .fan_out_count(fan_out_count)
        .updated_at(now);
    if is_direct {
        upd = upd.target_post_pk(anchor_post_pk.to_string());
    }
    if let Err(e) = SubTeamAnnouncement::repository()
        .update(announcement.id, upd)
        .await
    {
        crate::error!("handle_announcement_published: fan_out_count update failed: {e}");
    }

    Ok(())
}

fn build_post_detail_url(post_pk: &Partition) -> String {
    match post_pk {
        Partition::Feed(id) => format!("/posts/{id}"),
        other => format!("/posts/{other}"),
    }
}

#[cfg(feature = "server")]
pub async fn handle_space_published(
    cli: &aws_sdk_dynamodb::Client,
    space: crate::common::models::space::SpaceCommon,
) -> Result<()> {
    use crate::common::types::InboxPayload;
    use crate::features::posts::models::Post;
    use crate::features::posts::types::PostType;

    // The anchor Post lives on the Feed partition (`space.post_pk`), not the
    // Space partition.
    let post_id_uuid = match space.post_pk.parse::<Partition>() {
        Ok(Partition::Feed(id)) => Uuid::parse_str(&id).ok(),
        _ => None,
    };
    let Some(post_id_uuid) = post_id_uuid else {
        return Ok(());
    };
    let post = match Post::get_by_feed_id(post_id_uuid).await {
        Ok(Some(p)) => p,
        Ok(None) => return Ok(()),
        Err(e) => {
            crate::error!("handle_space_published: anchor post lookup failed: {e}");
            return Ok(());
        }
    };
    if !matches!(post.post_type, PostType::Post) {
        return Ok(());
    }
    let (Some(announcement_id), Some(parent_team_id)) = (
        post.announcement_id.clone(),
        post.announcement_parent_team_id.clone(),
    ) else {
        return Ok(());
    };

    let ann_pk = Partition::Team(parent_team_id.clone());
    let announcement = match SubTeamAnnouncement::find_in_team(&ann_pk, &announcement_id).await {
        Ok(Some(a)) => a,
        Ok(None) => return Ok(()),
        Err(e) => {
            crate::error!("handle_space_published: announcement lookup failed: {e}");
            return Ok(());
        }
    };
    if announcement.target_child_team_id.is_some() {
        return Ok(());
    }
    if announcement.broadcast_notified_at.is_some() {
        return Ok(());
    }

    let parent_partition = announcement.team_partition();
    let Ok(parent_team_uuid) = Uuid::parse_str(&parent_team_id) else {
        crate::error!("handle_space_published: invalid parent_team_id: {parent_team_id}");
        return Ok(());
    };
    let parent_team = match Team::get_by_id(parent_team_uuid).await {
        Ok(Some(t)) => t,
        Ok(None) => {
            crate::error!("handle_space_published: parent team not found: {parent_team_id}");
            return Ok(());
        }
        Err(e) => {
            crate::error!("handle_space_published: parent team fetch: {e}");
            return Ok(());
        }
    };

    let links = list_recognized_sub_teams(&parent_partition).await?;
    let anchor_post_pk = Partition::Feed(announcement.announcement_id.clone());
    // Space URL takes the raw id — matches the canonical `/spaces/:space_id`.
    let cta_url = format!("/spaces/{}", announcement.announcement_id);

    for link in &links {
        let child_team_pk = Partition::Team(link.child_team_id.clone());
        let members = resolve_team_members(cli, &child_team_pk)
            .await
            .unwrap_or_default();
        for u in members {
            let payload = InboxPayload::SubTeamAnnouncementReceived {
                parent_team_id: parent_team_id.clone(),
                parent_team_name: parent_team.display_name.clone(),
                announcement_id: announcement.announcement_id.clone(),
                title: announcement.title.clone(),
                post_id: announcement.announcement_id.clone(),
                post_pk: anchor_post_pk.to_string(),
                cta_url: cta_url.clone(),
            };
            if let Err(e) = crate::common::utils::inbox::create_inbox_row(u, payload).await {
                crate::error!("handle_space_published: inbox create failed: {e}");
            }
        }
    }

    let now = crate::common::utils::time::get_now_timestamp_millis();
    if let Err(e) = SubTeamAnnouncement::repository()
        .update(
            announcement.id,
            SubTeamAnnouncement::update()
                .broadcast_notified_at(now)
                .updated_at(now),
        )
        .await
    {
        crate::error!("handle_space_published: broadcast_notified_at write failed: {e}");
    }

    Ok(())
}
