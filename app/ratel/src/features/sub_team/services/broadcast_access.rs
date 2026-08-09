//! Audience gate for sub-team broadcast / direct-message Posts.
//!
//! Posts authored via `publish_announcement_handler` (broadcast to every
//! recognized child when `target_child_team_id = None`, 1:1 to a single
//! recognized child when `target_child_team_id = Some(child)`) are
//! written with `visibility = Visibility::Broadcast`. That marker hands
//! access control off to this module — Posts and any attached Space
//! refuse to render to viewers outside the audience.
//!
//! Audience by announcement shape:
//! - **Broadcast** (`SubTeamAnnouncement.target_child_team_id = None`):
//!   parent team's members ∪ every recognized child team's members.
//! - **Direct** (`SubTeamAnnouncement.target_child_team_id = Some(child)`):
//!   parent team's members ∪ the one target child team's members.
//!
//! "Member" = `TeamOwner.user_pk == viewer` OR `UserTeam(team_pk).pk == viewer`.
//! Anonymous viewers (no `User` extractor) always fail the gate.

use async_trait::async_trait;

use crate::common::*;
use crate::features::auth::UserTeam;
use crate::features::posts::models::{Post, Team, TeamOwner};
use crate::features::posts::types::PostError;
use crate::features::sub_team::models::{SubTeamAnnouncement, SubTeamAnnouncementFanout};

/// Parse a `Partition::Team(id)` into its `Uuid` — Postgres `Team`/`TeamOwner`
/// rows are keyed by the raw uuid, not the `"TEAM#…"` partition string.
fn team_uuid(team_pk: &Partition) -> Option<uuid::Uuid> {
    match team_pk {
        Partition::Team(id) => uuid::Uuid::parse_str(id).ok(),
        _ => None,
    }
}

/// Is `post` a sub-team broadcast / direct-message anchor? Cheap pure check.
pub fn is_broadcast_post(post: &Post) -> bool {
    matches!(
        post.visibility,
        Some(crate::features::posts::types::Visibility::Broadcast)
    ) || post.announcement_id.is_some()
}

/// Extension trait on `Post` that hides the broadcast / direct-message
/// access check behind a single `.assert_broadcast_access(cli, viewer)`
/// call. Used by `get_post_handler` and `get_space_handler` so the same
/// audience gate isn't duplicated at each surface — and so adding a
/// third surface in future (e.g. a public post-detail RSS endpoint)
/// is a single-line addition.
#[async_trait]
pub trait PostBroadcastAccessExt {
    /// Returns `Ok(())` if the viewer is allowed to read this Post.
    /// For non-broadcast posts this is a cheap no-op. For broadcast
    /// posts (visibility=Broadcast or announcement_id set) it resolves
    /// the audience via `can_view_broadcast_post` and returns
    /// `PostError::NotAccessible` on a miss.
    async fn assert_broadcast_access(
        &self,
        cli: &aws_sdk_dynamodb::Client,
        viewer: Option<&Partition>,
    ) -> Result<()>;
}

#[async_trait]
impl PostBroadcastAccessExt for Post {
    async fn assert_broadcast_access(
        &self,
        cli: &aws_sdk_dynamodb::Client,
        viewer: Option<&Partition>,
    ) -> Result<()> {
        if !is_broadcast_post(self) {
            return Ok(());
        }
        let allowed = can_view_broadcast_post(cli, self, viewer)
            .await
            .unwrap_or(false);
        if !allowed {
            return Err(PostError::NotAccessible.into());
        }
        Ok(())
    }
}

/// Resolve audience and return whether `viewer_user_pk` is allowed to see
/// `post`. Looks the source `SubTeamAnnouncement` up to learn direct vs
/// broadcast; broadcast access is decided by fanout-marker presence on
/// any team the viewer belongs to (current or former sub-team).
///
/// Anonymous viewers (`None`) are always rejected.
///
/// Bounds:
/// - One `SubTeamAnnouncement::get` (point read)
/// - Direct: at most 1 `TeamOwner` + paginated `UserTeam::find_by_team` per
///   member check (≤ 2 team-membership probes total).
/// - Broadcast: one `UserTeam::query` (viewer's teams, usually 1–2)
///   plus one `SubTeamAnnouncementFanout::get` per team.
pub async fn can_view_broadcast_post(
    cli: &aws_sdk_dynamodb::Client,
    post: &Post,
    viewer_user_pk: Option<&Partition>,
) -> Result<bool> {
    let Some(viewer) = viewer_user_pk else {
        return Ok(false);
    };

    let (Some(parent_team_id), Some(announcement_id)) = (
        post.announcement_parent_team_id.as_ref(),
        post.announcement_id.as_ref(),
    ) else {
        // Visibility says Broadcast but the announcement linkage is
        // missing — fail closed.
        return Ok(false);
    };

    let parent_pk = Partition::Team(parent_team_id.clone());

    // Parent membership is always part of the audience for both
    // broadcast and direct. Check it first — for posts the parent admin
    // is reading their own anchor this short-circuits without touching
    // the SubTeamAnnouncement row.
    if is_team_member(cli, &parent_pk, viewer).await? {
        return Ok(true);
    }

    // Need to know broadcast vs direct to scope the children check.
    let announcement = match SubTeamAnnouncement::find_in_team(&parent_pk, announcement_id).await {
        Ok(Some(a)) => a,
        Ok(None) => return Ok(false),
        Err(e) => {
            crate::error!("can_view_broadcast_post announcement lookup failed: {e}");
            return Ok(false);
        }
    };

    if let Some(target_child_id) = announcement.target_child_team_id {
        // Direct message: the one target child's members only.
        let child_pk = Partition::Team(target_child_id);
        return is_team_member(cli, &child_pk, viewer).await;
    }

    let user_teams = UserTeam::find_by_user(viewer).await.map_err(|e| {
        crate::error!("can_view_broadcast_post UserTeam query failed: {e}");
        Error::Internal
    })?;
    for ut in user_teams {
        let team_pk: Partition = match ut.team_pk.parse() {
            Ok(p) => p,
            Err(_) => continue,
        };
        let marker = SubTeamAnnouncementFanout::find_marker(&team_pk, announcement_id)
            .await
            .ok()
            .flatten();
        if marker.is_some() {
            return Ok(true);
        }
    }

    Ok(false)
}

/// Public alias for callers outside this module (e.g. the team-wall
/// query in `list_user_posts.rs`) that want to gate broadcast surfacing
/// on viewer membership. Same semantics as `is_team_member`.
pub async fn is_team_member_public(
    cli: &aws_sdk_dynamodb::Client,
    team_pk: &Partition,
    viewer: &Partition,
) -> Result<bool> {
    is_team_member(cli, team_pk, viewer).await
}

/// One-shot: "is `viewer` in this Post's broadcast audience?"
///
/// Combines the two pure checks every private-space gate (`get_space`,
/// `participate_space`, `SpaceUserRole` extractor) duplicated inline.
/// Returns `false` for non-broadcast posts (so callers can chain it
/// behind an explicit-invitation lookup without changing semantics) and
/// swallows transient lookup errors as `false` to fail-closed.
pub async fn is_broadcast_audience(
    cli: &aws_sdk_dynamodb::Client,
    post: &Post,
    viewer: &Partition,
) -> bool {
    if !is_broadcast_post(post) {
        return false;
    }
    can_view_broadcast_post(cli, post, Some(viewer))
        .await
        .unwrap_or(false)
}

/// `true` if `viewer` is the owner of `team_pk` (TeamOwner row) or a
/// UserTeam member of it. Stops at the first hit so the broadcast-fanout
/// path doesn't quadratically scan every child's roster.
async fn is_team_member(
    _cli: &aws_sdk_dynamodb::Client,
    team_pk: &Partition,
    viewer: &Partition,
) -> Result<bool> {
    let viewer_str = viewer.to_string();

    if let Some(uuid) = team_uuid(team_pk) {
        if let Ok(Some(owner)) = TeamOwner::find_by_team(uuid).await {
            if owner.user_pk == viewer_str {
                return Ok(true);
            }
        }
    }

    let rows = UserTeam::find_by_team(team_pk).await.map_err(|e| {
        crate::error!("is_team_member UserTeam query failed: {e}");
        Error::Internal
    })?;
    for row in rows {
        if row.user_pk == viewer_str {
            return Ok(true);
        }
    }

    Ok(false)
}

// Silence the dead-code lint when only `is_broadcast_post` is referenced
// from a feature build that doesn't enable the `Team` import path.
#[allow(dead_code)]
fn _silence_team_unused(_t: &Team) {}
