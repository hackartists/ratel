use crate::common::*;
use crate::features::auth::User;
use crate::features::cross_posting::models::{JobState, SyndicationJob};
use crate::features::cross_posting::types::{CrossPostingError, SocialPlatform};
use crate::features::posts::models::Post;
#[cfg(feature = "server")]
use crate::features::cross_posting::services::feed_id_of;
#[cfg(feature = "server")]
use postgres::PostgresEntity;

/// Author-initiated retry of a single `SyndicationJob` (FR-7 #44).
///
/// Resets the job to `Pending` and clears the dispatch shard / next-attempt
/// timestamp. The state change re-enters Stage 2 via the same event filter
/// (`state=Pending`) — no special re-enqueue path needed.
///
/// `Published` is the only blocked state — re-publishing an already-published
/// job risks double posting on the platform. Every other state retries:
///   - `Failed` (any category, including `auth_expired`) — user-initiated.
///   - `Pending` — covers stuck rows where the dispatcher died mid-flight;
///     UI exposes this so the author isn't dependent on infra recovery.
///   - `Skipped` — privacy guard re-runs in the dispatcher; if the post is
///     still private the row settles back to Skipped (idempotent no-op).
///
/// `attempts` is reset to 0 — the counter is purely informational now.
#[post("/api/cross-posting/posts/{post_id}/jobs/{platform}/retry", user: User)]
pub async fn retry_job_handler(post_id: FeedPartition, platform: SocialPlatform) -> Result<()> {
    let conf = crate::features::posts::config::get();
    let cli = conf.dynamodb();

    let post_pk: Partition = post_id.into();

    let post = Post::get(cli, &post_pk, Some(EntityType::Post))
        .await
        .map_err(|e| {
            crate::error!("retry_job post lookup failed: {e}");
            CrossPostingError::UpdateFailed
        })?
        .ok_or(CrossPostingError::NotAuthorized)?;

    if post.user_pk != user.pk {
        return Err(CrossPostingError::NotAuthorized.into());
    }

    let post_id_str = feed_id_of(&post_pk);
    let job = SyndicationJob::find_by_post_platform(&post_id_str, platform)
        .await
        .map_err(|e| {
            crate::error!("retry_job lookup failed: {e}");
            CrossPostingError::UpdateFailed
        })?
        .ok_or(CrossPostingError::SyndicationJobNotFound)?;

    if job.state == JobState::Published {
        return Err(CrossPostingError::RetryNotAllowed.into());
    }

    let now = crate::common::utils::time::now();
    // Setting `dispatch_shard = None` drops the row from the retry sweep; the
    // primary state stays Pending and the row re-enters Stage 2 via the
    // SyndicationJob change → filter on `state=Pending`.
    SyndicationJob::repository()
        .update(
            job.id,
            SyndicationJob::update()
                .state(JobState::Pending)
                .attempts(0)
                .dispatch_shard(None)
                .next_attempt_at(0)
                .updated_at(now),
        )
        .await
        .map_err(|e| {
            crate::error!("retry_job update failed: {e}");
            CrossPostingError::UpdateFailed
        })?;

    Ok(())
}
