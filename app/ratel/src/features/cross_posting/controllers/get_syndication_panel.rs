use crate::common::*;
use crate::features::auth::User;
use crate::features::cross_posting::models::{EngagementSnapshot, JobState, SyndicationJob};
use crate::features::cross_posting::types::{
    CrossPostingError, EngagementCountsView, SyndicationJobView, SyndicationPanelResponse,
};
use crate::features::posts::models::Post;

/// Author-only syndication panel (FR-7 #41–#45). Shows per-platform
/// dispatch state, retry diagnostics, and engagement counts for one of
/// the user's own posts. Returns `NotAuthorized` for posts whose
/// `user_pk` does not match the session user (Phase 1 supports only
/// user-owned cross-posting).
#[get("/api/cross-posting/posts/{post_id}/syndication", user: User)]
pub async fn get_syndication_panel_handler(
    post_id: FeedPartition,
) -> Result<SyndicationPanelResponse> {
    let post_uuid = uuid::Uuid::parse_str(&post_id.0).map_err(|_| CrossPostingError::NotAuthorized)?;

    let post = Post::get_by_feed_id(post_uuid)
        .await
        .map_err(|e| {
            crate::error!("get_syndication_panel post lookup failed: {e}");
            CrossPostingError::ListFailed
        })?
        .ok_or(CrossPostingError::NotAuthorized)?;

    if post.user_pk != user.pk().to_string() {
        return Err(CrossPostingError::NotAuthorized.into());
    }

    let post_id_str = post.feed_id();
    let jobs = SyndicationJob::find_by_post(&post_id_str).await.map_err(|e| {
        crate::error!("get_syndication_panel jobs query failed: {e}");
        CrossPostingError::ListFailed
    })?;

    // Hydrate engagement counts for Published jobs. At most 3 rows in
    // Phase 1 (Bluesky / LinkedIn / Threads) so sequential reads are fine.
    let mut views = Vec::with_capacity(jobs.len());
    for job in jobs {
        let engagement = if job.state == JobState::Published {
            EngagementSnapshot::find_by_post_platform(&post_id_str, job.platform)
                .await
                .ok()
                .flatten()
                .map(EngagementCountsView::from)
        } else {
            None
        };
        views.push(SyndicationJobView::from_job(job, engagement));
    }

    Ok(SyndicationPanelResponse { post_id, jobs: views })
}
