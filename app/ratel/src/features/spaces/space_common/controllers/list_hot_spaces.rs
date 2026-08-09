//! Read-only Hot Spaces feed.
//!
//! Every viewer (anonymous + logged-in) sees the same global ranked stream.
//! Ranking work happens in `services::space_fanout`, which writes one
//! `HotSpace` row per eligible space (Public+Published with at least
//! `MIN_PARTICIPANTS_FOR_HOT` participants) on the `HSR#ALL` GSI partition,
//! sorted by `WindowedRankKey`.
//!
//! This handler is a single GSI query against that index. No timeline
//! gating, no per-viewer fanout, no in-memory sort.

use crate::common::*;
#[cfg(feature = "server")]
use crate::features::auth::OptionalUser;
use crate::features::spaces::space_common::models::HotSpaceHeat;
#[cfg(feature = "server")]
use crate::features::spaces::space_common::models::HotSpace;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
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

#[get("/api/hot-spaces")]
pub async fn list_hot_spaces_handler() -> Result<ListResponse<HotSpaceResponse>> {
    debug!("Listing hot spaces");

    // The original endpoint took no input bookmark — return the top page.
    let page = 1i64;
    let page_size = 20i64;

    let result = HotSpace::find_ranked(page, page_size).await?;
    let has_next = result.page < result.total_pages;

    // Preserve the absolute 1-based rank across pages.
    let base_rank = (page - 1) * page_size;
    let items: Vec<HotSpaceResponse> = result
        .items
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
