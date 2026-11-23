//! Read-only Hot Spaces feed.
//!
//! Cached global ranked feed of hot spaces, identical for every viewer.

use crate::common::*;
#[cfg(feature = "server")]
use crate::features::auth::OptionalUser;
use crate::features::spaces::space_common::models::HotSpaceHeat;
#[cfg(feature = "server")]
use crate::features::spaces::space_common::models::HotSpace;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct HotSpaceResponse {
    pub space_id: SpacePartition,
    pub post_id: FeedPartition,
    pub title: String,
    pub description: String,
    pub logo: String,
    pub author_display_name: String,
    pub participants: i64,
    pub rewards: i64,
    pub poll_count: i64,
    pub discussion_count: i64,
    pub quiz_count: i64,
    pub follow_count: i64,
    pub total_actions: i64,
    pub heat: HotSpaceHeat,
    pub rank: i64,
    pub created_at: i64,
}

#[cfg(feature = "server")]
const HOT_SPACES_TTL: std::time::Duration = std::time::Duration::from_secs(30);

#[cfg(feature = "server")]
const HOT_SPACES_CACHE_CONTROL: &str = "public, max-age=30";

#[cfg(feature = "server")]
type HotSpacesSnapshot = (std::time::Instant, ListResponse<HotSpaceResponse>);

#[cfg(feature = "server")]
static HOT_SPACES_CACHE: tokio::sync::RwLock<Option<HotSpacesSnapshot>> =
    tokio::sync::RwLock::const_new(None);

#[cfg(feature = "server")]
static HOT_SPACES_REFRESH: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

/// Clears the cached hot-spaces page.
#[cfg(feature = "server")]
pub async fn clear_hot_spaces_cache() {
    *HOT_SPACES_CACHE.write().await = None;
}

#[cfg(feature = "server")]
async fn fresh_cached_hot_spaces() -> Option<ListResponse<HotSpaceResponse>> {
    HOT_SPACES_CACHE
        .read()
        .await
        .as_ref()
        .filter(|(at, _)| at.elapsed() < HOT_SPACES_TTL)
        .map(|(_, v)| v.clone())
}

/// Returns the cached hot-spaces page, reloading it when the cache is stale.
#[cfg(feature = "server")]
async fn cached_hot_spaces() -> Result<ListResponse<HotSpaceResponse>> {
    if let Some(hit) = fresh_cached_hot_spaces().await {
        return Ok(hit);
    }
    let _refresh = HOT_SPACES_REFRESH.lock().await;
    if let Some(hit) = fresh_cached_hot_spaces().await {
        return Ok(hit);
    }
    let loaded = load_hot_spaces().await?;
    *HOT_SPACES_CACHE.write().await = Some((std::time::Instant::now(), loaded.clone()));
    Ok(loaded)
}

#[get("/api/hot-spaces")]
pub async fn list_hot_spaces_handler() -> Result<ListResponse<HotSpaceResponse>> {
    debug!("Listing hot spaces");

    let response = cached_hot_spaces().await?;
    if let Some(ctx) = dioxus::fullstack::FullstackContext::current() {
        ctx.add_response_header(
            dioxus::fullstack::axum::http::header::CACHE_CONTROL,
            dioxus::fullstack::axum::http::HeaderValue::from_static(HOT_SPACES_CACHE_CONTROL),
        );
    }
    Ok(response)
}

#[cfg(feature = "server")]
async fn load_hot_spaces() -> Result<ListResponse<HotSpaceResponse>> {
    let page = 1i64;
    let page_size = 20i64;

    let (rows, has_next) = HotSpace::find_ranked(page, page_size).await?;

    let base_rank = (page - 1) * page_size;
    let items: Vec<HotSpaceResponse> = rows
        .into_iter()
        .enumerate()
        .map(|(idx, h)| HotSpaceResponse {
            space_id: SpacePartition(h.space_id),
            post_id: FeedPartition(h.post_id),
            title: h.title,
            description: h.description,
            logo: h.logo,
            author_display_name: h.author_display_name,
            participants: h.participants,
            rewards: h.rewards,
            poll_count: h.poll_count,
            discussion_count: h.discussion_count,
            quiz_count: h.quiz_count,
            follow_count: h.follow_count,
            total_actions: h.total_actions,
            heat: h.heat,
            rank: base_rank + idx as i64 + 1,
            created_at: h.space_created_at,
        })
        .collect();

    let next = if has_next {
        Some((page + 1).to_string())
    } else {
        None
    };

    Ok((items, next).into())
}
