//! Stage 1 of the cross-posting pipeline — the **factory**.
//!
//! Triggered by an EventBridge Pipe on `Post` MODIFY events where
//! `OldImage.status != "Published" && NewImage.status == "Published"
//! && NewImage.visibility == "Public"` (Pipe filter handles the
//! transition + visibility checks; this handler trusts that).
//!
//! Reads the post's [`PostSyndicationDirective`] sidecar, intersects
//! `directive.enabled_platforms` with the author's currently-connected
//! `SocialConnection` rows (`status == Connected && auto_post_enabled`),
//! and writes one [`SyndicationJob`] row per matching platform. Each job
//! is independent — per FR-5 #32, one platform's failure must not affect
//! the others.
//!
//! Absent directive = silent exit (Ratel-only post; no syndication intent).

use crate::common::*;
use crate::common::utils::time;
use crate::features::cross_posting::models::{
    ConnectionStatus, JobState, PostSyndicationDirective, SocialConnection, SyndicationJob,
};
use crate::features::cross_posting::types::SocialPlatform;
use crate::features::posts::models::Post;
use std::collections::HashMap;
use uuid::Uuid;

/// Stage 1 factory entry point. Called from `EventBridgeEnvelope::proc` on
/// `DetailType::PostPublishedForSyndication`.
pub async fn handle_post_published_for_syndication(post: Post) -> Result<()> {
    // `post` still arrives as the (cross-feature) posts `Post` entity; only
    // its bare feed id is needed to key the cross-posting rows.
    let post_id = post.feed_id();

    // 1. Look up the directive sidecar. Absence = "this post is Ratel-only"
    //    (per PR D, the directive is only written when enabled_platforms
    //    resolves to non-empty under public visibility). Silent exit on miss.
    let directive = PostSyndicationDirective::find_by_post(&post_id)
        .await
        .map_err(|e| {
            tracing::error!(post_id = %post_id, error = %e, "factory: directive lookup failed");
            e
        })?;

    let Some(directive) = directive else {
        tracing::debug!(
            post_id = %post_id,
            "factory: no SyndicationDirective; post is Ratel-only — skipping"
        );
        return Ok(());
    };

    if directive.enabled_platforms.0.is_empty() {
        // Defensive: PR D's gate filters this out, but log + exit cleanly
        // if a future code path writes an empty directive.
        tracing::warn!(post_id = %post_id, "factory: directive has empty enabled_platforms");
        return Ok(());
    }

    // 2. Read the author's SocialConnection rows. Index by platform for
    //    O(1) lookup in step 3. Filter to rows that are both Connected
    //    AND have the per-platform auto_post toggle on.
    let user_id = directive.author_user_id.clone();
    let connections = SocialConnection::find_by_user(&user_id).await.map_err(|e| {
        tracing::error!(user_id = %user_id, error = %e, "factory: connection query failed");
        e
    })?;

    let mut connected: HashMap<SocialPlatform, &SocialConnection> = HashMap::new();
    for c in &connections {
        if c.status == ConnectionStatus::Connected && c.auto_post_enabled {
            connected.insert(c.platform, c);
        }
    }

    // 3. Bake one job per platform in (directive.enabled ∩ connected).
    let now = time::now();
    let canonical_url = format!(
        "{}/posts/{}",
        crate::common::config::site_base_url(),
        post_id
    );

    for platform in &directive.enabled_platforms.0 {
        if !connected.contains_key(platform) {
            tracing::debug!(
                post_id = %post_id,
                ?platform,
                "factory: platform in directive but not connected (or auto_post off) for user"
            );
            continue;
        }

        let backlink_url = format!("{canonical_url}?utm_source={platform}");

        // Idempotency note: SyndicationJob's natural key is
        // (post_id, platform). On replay (event reprocessing or retry)
        // `upsert_on` overwrites the row — matching the DynamoDB PutItem
        // "last write wins" semantics — potentially resetting a Published
        // row back to Pending and causing a second publish. Phase 1
        // internal-staging accepts this rare edge case; production hardening
        // before 1D enable should guard on the existing terminal state.
        let job = SyndicationJob {
            id: Uuid::now_v7(),
            post_id: post_id.clone(),
            dispatch_shard: None,
            engagement_shard: None,
            next_attempt_at: 0,
            engagement_next_at: 0,
            author_user_id: user_id.clone(),
            platform: *platform,
            state: JobState::Pending,
            attempts: 0,
            last_error_category: None,
            last_error_message: None,
            external_post_id: None,
            external_post_url: None,
            body_snapshot_len: 0,
            backlink_url,
            dispatch_lock_id: None,
            lock_acquired_at: None,
            created_at: now,
            updated_at: now,
        };

        if let Err(e) = SyndicationJob::repository()
            .upsert_on(&["post_id", "platform"], &job)
            .await
        {
            // FR-5 #32: per-platform job rows are independent. Log only —
            // don't propagate, other platforms still get a chance.
            tracing::error!(
                post_id = %post_id,
                ?platform,
                error = %e,
                "factory: SyndicationJob create failed"
            );
        } else {
            tracing::info!(
                post_id = %post_id,
                ?platform,
                "factory: SyndicationJob created"
            );
            // Phase 5: emit so the outbox poller dispatches "SyndicationJobReady"
            // (handle_syndication_job_ready) — the Postgres analogue of the
            // SYNDICATION_JOB# stream record that drove per-platform dispatch.
            crate::common::events::outbox::EventOutbox::emit_insert(
                crate::common::events::outbox::topic::SYNDICATION_JOB,
                &job,
            )
            .await
            .ok();
        }
    }

    Ok(())
}
