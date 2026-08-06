use crate::common::models::space::SpaceCommon;
use crate::common::types::SpacePublishState;
use crate::features::auth::OptionalUser;
use crate::features::posts::controllers::dto::*;
use crate::features::posts::models::*;
use crate::features::posts::types::*;
use crate::features::posts::*;
use crate::features::sub_team::models::{
    SubTeamAnnouncement, SubTeamAnnouncementFanout, SubTeamAnnouncementStatus,
};
use std::collections::HashMap;

#[cfg(feature = "server")]
use postgres::PostgresEntity;

#[cfg(feature = "server")]
fn bookmark_to_page(bookmark: &Option<String>) -> i64 {
    bookmark
        .as_deref()
        .and_then(|b| b.parse::<i64>().ok())
        .filter(|p| *p >= 1)
        .unwrap_or(1)
}

#[cfg(feature = "server")]
fn next_bookmark(page: i64, total_pages: i64) -> Option<String> {
    if page < total_pages {
        Some((page + 1).to_string())
    } else {
        None
    }
}

#[get("/api/posts/by-user/:username?bookmark", user: OptionalUser)]
pub async fn list_user_posts_handler(
    username: String,
    bookmark: Option<String>,
) -> Result<ListItemsResponse<PostResponse>> {
    let conf = crate::features::posts::config::get();
    let cli = conf.dynamodb();

    let user: Option<crate::features::auth::User> = user.into();

    tracing::debug!(
        "list_user_posts_handler: username = {:?} bookmark = {:?}",
        username,
        bookmark
    );

    let target_user = crate::features::auth::User::find_by_username(&username)
        .await?
        .ok_or(Error::PostInvalidUsername)?;
    let user_pk = target_user.pk();
    let is_owner = match &user {
        Some(user) => user.pk() == user_pk,
        None => false,
    };

    let page = bookmark_to_page(&bookmark);
    // Owner sees all visibilities; others only Public.
    let visibility = if is_owner {
        None
    } else {
        Some(Visibility::Public)
    };
    let result =
        Post::find_by_user_and_status(&user_pk, PostStatus::Published, visibility, page, 10).await?;
    let bookmark = next_bookmark(page, result.total_pages);
    let posts = result.items;

    tracing::debug!(
        "list_user_posts_handler: found {} posts, next bookmark = {:?}",
        posts.len(),
        bookmark
    );

    let liked_ids = match (&user, posts.is_empty()) {
        (Some(user), false) => {
            let ids: Vec<uuid::Uuid> = posts.iter().map(|p| p.id).collect();
            PostLike::liked_post_ids(&user.pk(), ids).await?
        }
        _ => Default::default(),
    };

    let items: Vec<PostResponse> = posts
        .into_iter()
        .map(|post| {
            let liked = liked_ids.contains(&post.id);
            PostResponse::from(post).with_like(liked)
        })
        .collect();

    Ok(ListItemsResponse { items, bookmark })
}

#[get("/api/posts/by-team/:teamname?category&bookmark", user: OptionalUser)]
pub async fn list_team_posts_handler(
    teamname: String,
    category: Option<String>,
    bookmark: Option<String>,
) -> Result<ListItemsResponse<PostResponse>> {
    let conf = crate::features::posts::config::get();
    let cli = conf.dynamodb();

    let user: Option<crate::features::auth::User> = user.into();

    tracing::debug!(
        "list_team_posts_handler: teamname = {:?} category = {:?} bookmark = {:?}",
        teamname,
        category,
        bookmark
    );

    let team = Team::find_by_username(&teamname)
        .await?
        .ok_or(Error::NotFound(format!("Team not found: {}", teamname)))?;
    let team_pk = team.partition();

    let page = bookmark_to_page(&bookmark);
    // Category filtering is applied client-side below, so pull a larger page
    // when a category is requested (mirrors the old fetch_limit heuristic).
    let fetch_limit = if category.is_some() { 50 } else { 10 };
    let result =
        Post::find_by_user_and_status(&team_pk, PostStatus::Published, None, page, fetch_limit)
            .await?;
    let bookmark = next_bookmark(page, result.total_pages);
    let posts = result.items;

    // Union the team's own Posts with broadcast anchor Posts.
    let viewer_pk = user.as_ref().map(|u| u.pk());
    let posts = merge_broadcast_anchors(cli, &team_pk, posts, viewer_pk.as_ref()).await;

    // Category filter.
    let posts = if let Some(ref cat) = category {
        posts
            .into_iter()
            .filter(|p| p.categories.0.iter().any(|c| c == cat.as_str()))
            .collect::<Vec<_>>()
    } else {
        posts
            .into_iter()
            .filter(|p| {
                !p.categories
                    .0
                    .iter()
                    .any(|c| c == "Bylaws" || c == "ClubBylaws")
            })
            .collect::<Vec<_>>()
    };

    // Hide broadcast Posts whose attached Space is still Draft (child walls only).
    let posts = filter_unpublished_broadcast_spaces(&team_pk, posts).await;

    tracing::debug!(
        "list_team_posts_handler: found {} posts, next bookmark = {:?}",
        posts.len(),
        bookmark
    );

    let liked_ids = match (&user, posts.is_empty()) {
        (Some(user), false) => {
            let ids: Vec<uuid::Uuid> = posts.iter().map(|p| p.id).collect();
            PostLike::liked_post_ids(&user.pk(), ids).await?
        }
        _ => Default::default(),
    };

    let items: Vec<PostResponse> = posts
        .into_iter()
        .map(|post| {
            let liked = liked_ids.contains(&post.id);
            PostResponse::from(post).with_like(liked)
        })
        .collect();

    Ok(ListItemsResponse { items, bookmark })
}

/// Union the team's own Posts with anchor Posts pointed at by every
/// `SubTeamAnnouncementFanout` marker filed under this team's pk.
///
/// `SubTeamAnnouncementFanout` / `SubTeamAnnouncement` / `Post` are all
/// Postgres now; `cli` is retained only for the (still-DynamoDB)
/// team-membership gate below (`is_team_member_public`).
#[cfg(feature = "server")]
async fn merge_broadcast_anchors(
    cli: &aws_sdk_dynamodb::Client,
    team_pk: &Partition,
    own_posts: Vec<Post>,
    viewer: Option<&Partition>,
) -> Vec<Post> {
    let mut anchor_ids: Vec<uuid::Uuid> = Vec::new();

    // Source 1 — fanout markers (child team wall).
    use postgres::ops::StringOp;
    match SubTeamAnnouncementFanout::repository()
        .find(
            SubTeamAnnouncementFanout::query()
                .child_team_pk(StringOp::Eq(team_pk.to_string()))
                .page_size(100),
        )
        .await
    {
        Ok(page) => {
            for m in page.items {
                if let Ok(id) = uuid::Uuid::parse_str(&m.announcement_id) {
                    anchor_ids.push(id);
                }
            }
        }
        Err(e) => {
            tracing::warn!("merge_broadcast_anchors: marker query failed: {e}");
        }
    };

    // Source 2 — parent team's own announcements.
    if matches!(team_pk, Partition::Team(_)) {
        match SubTeamAnnouncement::page_for_team(team_pk, 1, 100).await {
            Ok(page) => {
                for a in page.items {
                    if !matches!(a.status, SubTeamAnnouncementStatus::Published) {
                        continue;
                    }
                    if a.target_child_team_id.is_some() {
                        continue;
                    }
                    if let Ok(id) = uuid::Uuid::parse_str(&a.announcement_id) {
                        anchor_ids.push(id);
                    }
                }
            }
            Err(e) => {
                tracing::warn!("merge_broadcast_anchors: announcement query failed: {e}");
            }
        };
    }

    if anchor_ids.is_empty() {
        return own_posts;
    }

    // Dedup anchor ids before the batch fetch.
    let mut seen: HashMap<uuid::Uuid, ()> = HashMap::new();
    anchor_ids.retain(|p| seen.insert(*p, ()).is_none());

    // Membership gate.
    let viewer_is_member = match viewer {
        Some(v) => crate::features::sub_team::services::broadcast_access::is_team_member_public(
            cli, team_pk, v,
        )
        .await
        .unwrap_or(false),
        None => false,
    };
    if !viewer_is_member {
        return own_posts;
    }

    let anchors: Vec<Post> = Post::get_many(anchor_ids).await.unwrap_or_default();
    let anchors: Vec<Post> = anchors
        .into_iter()
        .filter(|p| matches!(p.status, PostStatus::Published))
        .collect();

    let mut by_pk: HashMap<String, Post> = HashMap::new();
    for p in own_posts {
        by_pk.insert(p.id.to_string(), p);
    }
    for p in anchors {
        by_pk.entry(p.id.to_string()).or_insert(p);
    }

    let mut merged: Vec<Post> = by_pk.into_values().collect();
    merged.sort_by(|a, b| {
        b.pinned_as_announcement
            .cmp(&a.pinned_as_announcement)
            .then_with(|| b.created_at.cmp(&a.created_at))
    });
    merged
}

/// Hide broadcast Posts whose attached Space is still in `Draft` publish-state
/// from child team walls only. `SpaceCommon` is now Postgres, so the space
/// lookup is a single indexed `space_pk IN (...)` query — no `cli` needed.
#[cfg(feature = "server")]
async fn filter_unpublished_broadcast_spaces(team_pk: &Partition, posts: Vec<Post>) -> Vec<Post> {
    let wall_team_id: Option<&str> = match team_pk {
        Partition::Team(id) => Some(id.as_str()),
        _ => None,
    };

    let mut to_check: Vec<Partition> = posts
        .iter()
        .filter(|p| p.announcement_id.is_some() && p.space_pk.is_some())
        .filter(|p| p.announcement_parent_team_id.as_deref() != wall_team_id)
        .filter_map(|p| p.space_pk.as_ref().and_then(|s| s.parse::<Partition>().ok()))
        .collect();
    to_check.sort_by(|a, b| a.to_string().cmp(&b.to_string()));
    to_check.dedup_by(|a, b| a.to_string() == b.to_string());

    if to_check.is_empty() {
        return posts;
    }

    use postgres::ops::StringOp;
    let space_pk_strings: Vec<String> = to_check.iter().map(|p| p.to_string()).collect();
    let spaces: Vec<SpaceCommon> = SpaceCommon::repository()
        .find(SpaceCommon::query().space_pk(StringOp::In(space_pk_strings)))
        .await
        .map(|page| page.items)
        .unwrap_or_default();
    let publish_states: HashMap<String, SpacePublishState> = spaces
        .into_iter()
        .map(|s| (s.space_pk.clone(), s.publish_state))
        .collect();

    posts
        .into_iter()
        .filter(|p| {
            if p.announcement_id.is_none() {
                return true;
            }
            if p.announcement_parent_team_id.as_deref() == wall_team_id {
                return true;
            }
            let Some(space_pk) = p.space_pk.as_ref() else {
                return true;
            };
            matches!(
                publish_states.get(space_pk),
                Some(SpacePublishState::Published)
            )
        })
        .collect()
}
