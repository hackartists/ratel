//! Stage 2 of the cross-posting pipeline — the **dispatcher**.
//!
//! Triggered on SyndicationJob INSERT or MODIFY whose `NewImage.state ==
//! "pending"`. Implements the 6-step idempotency-safe flow from the design
//! doc:
//! 1. **Acquire lock** via a conditional `UPDATE` (state=Pending AND
//!    (lock unset OR TTL elapsed)) that returns 0 affected rows when another
//!    invocation owns the dispatch — then we exit.
//! 2. **Reconcile stolen lock**: when we just stole an expired lock, the
//!    previous attempt may have published before dying; probe the platform
//!    via `adapter.find_by_backlink` and adopt the result if found.
//! 3. **Privacy guard**: re-read `Post`; if it's no longer Public/Published,
//!    mark Skipped (FR-6 #39).
//! 4. **Resolve images + body**.
//! 5. **Publish** through the platform adapter.
//! 6. **Commit terminal state** (Published / Failed / Skipped) with an
//!    optimistic `WHERE dispatch_lock_id = :my_lock_id` guard so a stolen-lock
//!    holder cannot overwrite the legitimate finisher.
//!
//! Postgres migration: the DynamoDB conditional / two-phase-commit writes are
//! rewritten as explicit SQL optimistic-lock `UPDATE`s executed through the
//! entity repository's pooled connection; `affected == 0` is the SQL analogue
//! of DynamoDB's `ConditionalCheckFailedException`. See risky_notes.

use crate::common::models::notification::UserInboxNotification;
use crate::common::types::InboxPayload;
use crate::common::utils::time;
use crate::common::*;
use crate::features::cross_posting::models::{
    ConnectionStatus, CredentialCiphertext, ErrorCategory, JobState, LOCK_TTL_SEC, SocialConnection,
    SyndicationJob,
};
use crate::features::cross_posting::services::adapters::{
    BlueskyAdapter, CrossPostAdapter, DecryptedCredentials, ImageRef, LinkCard, LinkedInAdapter,
    PlatformError, PublishedRef,
};
use crate::features::cross_posting::services::{credentials, format, shard};
use crate::features::cross_posting::types::{CrossPostingError, SocialPlatform};
use crate::features::posts::models::Post;
use crate::features::posts::types::{PostStatus, Visibility};
use postgres::PostgresEntity;
use postgres::Value;
use postgres::sqlx::{Postgres, QueryBuilder};
use uuid::Uuid;

/// Stage 2 entry point. Called from `EventBridgeEnvelope::proc` on
/// `DetailType::SyndicationJobReady`.
pub async fn handle_syndication_job_ready(job: SyndicationJob) -> Result<()> {
    // DynamoDB client is still needed for the `UserInboxNotification` write
    // (owned by another, not-yet-migrated feature). The `Post` read below is
    // Postgres-backed now and no longer needs it.
    let cfg = crate::common::CommonConfig::default();
    let cli = cfg.dynamodb();
    let now = time::now();
    let now_secs = now / 1000;

    // ── (1) Acquire lock ───────────────────────────────────────────────
    let lock_id = Uuid::now_v7().to_string();
    let acquired = match try_acquire_lock(&job, &lock_id, now_secs).await? {
        Some(prev) => prev,
        None => {
            tracing::debug!(
                post_id = %job.post_id, platform = ?job.platform,
                "dispatcher: lock not acquired (state changed or held within TTL) — exiting"
            );
            return Ok(());
        }
    };

    let stolen = acquired.had_existing_lock;
    if stolen {
        tracing::warn!(
            post_id = %job.post_id, platform = ?job.platform,
            "dispatcher: stole expired lock — will reconcile via find_by_backlink"
        );
    }

    // ── (3-prep) Read Post for privacy guard + body formatting ────────
    let post = match uuid::Uuid::parse_str(&job.post_id) {
        Ok(post_uuid) => Post::get_by_feed_id(post_uuid).await,
        Err(_) => Ok(None),
    };
    let post = match post {
        Ok(Some(p)) => p,
        Ok(None) => {
            tracing::error!(post_id = %job.post_id, "dispatcher: Post not found — marking Skipped");
            commit_skipped(&job, &lock_id, now).await?;
            return Ok(());
        }
        Err(e) => {
            tracing::error!(post_id = %job.post_id, error = %e, "dispatcher: Post lookup failed");
            // Don't release the lock — let TTL expire so the next invocation
            // can retry. Returning error makes the invocation fail and the
            // event source will retry with the same event.
            return Err(e);
        }
    };

    // ── (3) Privacy guard re-check ─────────────────────────────────────
    if post.visibility != Some(Visibility::Public) || post.status != PostStatus::Published {
        tracing::info!(
            post_id = %job.post_id,
            visibility = ?post.visibility,
            status = ?post.status,
            "dispatcher: post no longer public/published — marking Skipped"
        );
        commit_skipped(&job, &lock_id, now).await?;
        return Ok(());
    }

    // ── Adapter selection ─────────────────────────────────────────────
    let adapter: Box<dyn CrossPostAdapter> = match job.platform {
        SocialPlatform::Bluesky => Box::new(BlueskyAdapter::new()),
        SocialPlatform::LinkedIn => Box::new(LinkedInAdapter::new()),
        SocialPlatform::Threads => {
            tracing::warn!(
                post_id = %job.post_id,
                platform = ?job.platform,
                "dispatcher: platform adapter not implemented yet — marking Failed"
            );
            let msg = "platform adapter not implemented yet".to_string();
            commit_failed(
                &job,
                &lock_id,
                ErrorCategory::Unknown,
                &msg,
                job.attempts.saturating_add(1),
                now,
            )
            .await?;
            notify_failure(cli, &job, ErrorCategory::Unknown, Some(msg)).await;
            return Ok(());
        }
    };

    // ── Load + decrypt credentials ────────────────────────────────────
    let connection = SocialConnection::find_by_user_platform(&job.author_user_id, job.platform)
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "dispatcher: SocialConnection lookup failed");
            CrossPostingError::CommitFailed
        })?;

    let connection = match connection {
        Some(c) if c.status == ConnectionStatus::Connected => c,
        Some(_) => {
            let msg = "connection no longer Connected (revoked or auth-expired)".to_string();
            commit_failed(
                &job,
                &lock_id,
                ErrorCategory::AuthExpired,
                &msg,
                job.attempts.saturating_add(1),
                now,
            )
            .await?;
            notify_failure(cli, &job, ErrorCategory::AuthExpired, Some(msg)).await;
            return Ok(());
        }
        None => {
            let msg = "SocialConnection row not found".to_string();
            commit_failed(
                &job,
                &lock_id,
                ErrorCategory::AuthExpired,
                &msg,
                job.attempts.saturating_add(1),
                now,
            )
            .await?;
            notify_failure(cli, &job, ErrorCategory::AuthExpired, Some(msg)).await;
            return Ok(());
        }
    };

    let creds = match credentials::open_credentials(&connection.credential_ciphertext.0) {
        Ok(c) => c,
        Err(e) => {
            tracing::error!(error = %e, "dispatcher: credential decrypt failed");
            let msg = "credential decrypt failed".to_string();
            commit_failed(
                &job,
                &lock_id,
                ErrorCategory::AuthExpired,
                &msg,
                job.attempts.saturating_add(1),
                now,
            )
            .await?;
            notify_failure(cli, &job, ErrorCategory::AuthExpired, Some(msg)).await;
            return Ok(());
        }
    };

    // ── (2) Stolen-lock reconcile ──────────────────────────────────────
    if stolen {
        match adapter.find_by_backlink(creds.clone(), &job.backlink_url).await {
            Ok(Some(prior)) => {
                tracing::info!(
                    post_id = %job.post_id,
                    "dispatcher: reconciled — prior attempt published; adopting result"
                );
                commit_published(&job, &lock_id, &prior, now).await?;
                return Ok(());
            }
            Ok(None) => {
                tracing::debug!(
                    post_id = %job.post_id,
                    "dispatcher: reconcile probe returned no prior post; proceeding with publish"
                );
            }
            Err(e) => {
                tracing::warn!(
                    post_id = %job.post_id,
                    error = ?e,
                    "dispatcher: find_by_backlink probe failed during reconcile — proceeding"
                );
            }
        }
    }

    // ── (4) Resolve images + body ──────────────────────────────────────
    let images: Vec<ImageRef> = post
        .urls
        .0
        .iter()
        .take(adapter.max_images())
        .map(|url| ImageRef::from_s3(url))
        .collect();

    let body = format::format_for_platform(&post, job.platform, &job.backlink_url);
    let body_len = body.chars().count() as i32;
    let link_card = build_link_card(&post, &job);

    // ── (5) Publish — inline retry once on retryable failures ────────
    let mut current_creds = creds;
    let mut result = adapter
        .publish(
            current_creds.clone(),
            body.clone(),
            images.clone(),
            link_card.clone(),
        )
        .await;

    if let Err(err) = &result {
        let category = classify_platform_error(err);
        if matches!(category, ErrorCategory::AuthExpired) {
            tracing::warn!(
                post_id = %job.post_id,
                platform = ?job.platform,
                "dispatcher: publish hit AuthExpired — attempting credential refresh",
            );
            match adapter.try_refresh_credentials(current_creds.clone()).await {
                Ok(refreshed) => {
                    if let Err(persist_err) =
                        persist_refreshed_credentials(&connection, &refreshed).await
                    {
                        tracing::warn!(
                            post_id = %job.post_id,
                            platform = ?job.platform,
                            error = %persist_err,
                            "dispatcher: refreshed creds but persist failed — proceeding with rotated tokens",
                        );
                    } else {
                        tracing::info!(
                            post_id = %job.post_id,
                            platform = ?job.platform,
                            "dispatcher: credential refresh ok — retrying publish with rotated tokens",
                        );
                    }
                    current_creds = refreshed;
                    result = adapter
                        .publish(
                            current_creds.clone(),
                            body.clone(),
                            images.clone(),
                            link_card.clone(),
                        )
                        .await;
                }
                Err(refresh_err) => {
                    tracing::warn!(
                        post_id = %job.post_id,
                        platform = ?job.platform,
                        error = %refresh_err,
                        "dispatcher: credential refresh failed — leaving publish error as AuthExpired",
                    );
                }
            }
        } else if is_retryable(category) {
            tracing::warn!(
                post_id = %job.post_id,
                platform = ?job.platform,
                ?category,
                "dispatcher: first publish failed (retryable) — retrying inline"
            );
            result = adapter.publish(current_creds, body, images, link_card).await;
        }
    }

    // ── (6) Commit terminal state ──────────────────────────────────────
    match result {
        Ok(published) => {
            tracing::info!(
                post_id = %job.post_id,
                platform = ?job.platform,
                external = %published.external_post_url,
                "dispatcher: publish ok"
            );
            commit_published_with_body_len(&job, &lock_id, &published, body_len, now).await?;
            Ok(())
        }
        Err(err) => {
            let category = classify_platform_error(&err);
            let new_attempts = job.attempts.saturating_add(1);
            let msg = format!("{err}");

            tracing::error!(
                post_id = %job.post_id,
                platform = ?job.platform,
                ?category,
                attempts = new_attempts,
                "dispatcher: publish failed after inline retry"
            );

            commit_failed(&job, &lock_id, category, &msg, new_attempts, now).await?;
            notify_failure(cli, &job, category, Some(msg)).await;
            Ok(())
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────
// Lock acquisition
// ─────────────────────────────────────────────────────────────────────────

struct LockAcquired {
    /// True when the row had a `dispatch_lock_id` set at the moment we
    /// acquired (TTL had expired). Triggers the reconcile probe in step 2.
    had_existing_lock: bool,
}

/// Conditional `UPDATE` that sets `dispatch_lock_id` / `lock_acquired_at` when
/// no lock is held OR the existing lock's TTL has elapsed, with state still
/// Pending. Returns:
/// - `Ok(Some(_))` — the update affected the row; we now own the lock.
/// - `Ok(None)` — 0 rows affected; another invocation owns it or state changed.
/// - `Err(_)` — DB error (transient, propagate).
///
/// `had_existing_lock` is derived from a best-effort pre-read (used only to
/// decide the reconcile probe); the atomic acquire itself is the `UPDATE`'s
/// `WHERE`. See risky_notes for the non-atomicity of that heuristic vs the
/// DynamoDB `ReturnValue::AllOld` it replaces.
async fn try_acquire_lock(
    job: &SyndicationJob,
    lock_id: &str,
    now_secs: i64,
) -> Result<Option<LockAcquired>> {
    let ttl_threshold = now_secs - LOCK_TTL_SEC;

    let had_existing_lock = SyndicationJob::find_by_post_platform(&job.post_id, job.platform)
        .await
        .ok()
        .flatten()
        .and_then(|j| j.dispatch_lock_id)
        .is_some();

    let table = SyndicationJob::table_name();
    let mut qb = QueryBuilder::<Postgres>::new(format!("UPDATE \"{table}\" SET dispatch_lock_id = "));
    Value::from(lock_id.to_string()).push_bind(&mut qb);
    qb.push(", lock_acquired_at = ");
    Value::from(now_secs).push_bind(&mut qb);
    qb.push(", updated_at = ");
    Value::from(now_secs * 1000).push_bind(&mut qb);
    qb.push(" WHERE post_id = ");
    Value::from(job.post_id.clone()).push_bind(&mut qb);
    qb.push(" AND platform = ");
    Value::from(job.platform).push_bind(&mut qb);
    qb.push(" AND state = ");
    Value::from(JobState::Pending).push_bind(&mut qb);
    qb.push(" AND (dispatch_lock_id IS NULL OR lock_acquired_at < ");
    Value::from(ttl_threshold).push_bind(&mut qb);
    qb.push(")");

    let repo = SyndicationJob::repository();
    let affected = repo.db().execute(qb).await.map_err(|e| {
        tracing::error!(error = %e, "dispatcher: try_acquire_lock unexpected DB error");
        CrossPostingError::DispatchLockFailed
    })?;

    if affected == 0 {
        Ok(None)
    } else {
        Ok(Some(LockAcquired { had_existing_lock }))
    }
}

// ─────────────────────────────────────────────────────────────────────────
// Commit helpers — all conditional on `dispatch_lock_id = :my_lock_id`
// so a stolen-lock holder cannot overwrite the legitimate finisher. A 0-row
// result means the lock was lost → CommitFailed (mirrors the DynamoDB
// ConditionalCheckFailed → CommitFailed mapping).
// ─────────────────────────────────────────────────────────────────────────

/// Shared tail: `WHERE post_id = .. AND platform = .. AND dispatch_lock_id = ..`,
/// execute, and map `affected == 0` to `CommitFailed`.
async fn finish_commit(
    mut qb: QueryBuilder<'_, Postgres>,
    job: &SyndicationJob,
    lock_id: &str,
) -> Result<()> {
    qb.push(" WHERE post_id = ");
    Value::from(job.post_id.clone()).push_bind(&mut qb);
    qb.push(" AND platform = ");
    Value::from(job.platform).push_bind(&mut qb);
    qb.push(" AND dispatch_lock_id = ");
    Value::from(lock_id.to_string()).push_bind(&mut qb);

    let repo = SyndicationJob::repository();
    let affected = repo.db().execute(qb).await.map_err(|e| {
        tracing::error!(error = %e, "dispatcher: commit update failed");
        CrossPostingError::CommitFailed
    })?;

    if affected == 0 {
        tracing::error!(
            post_id = %job.post_id,
            "dispatcher: commit affected 0 rows — lock lost"
        );
        return Err(CrossPostingError::CommitFailed.into());
    }
    Ok(())
}

async fn commit_skipped(job: &SyndicationJob, lock_id: &str, now_ms: i64) -> Result<()> {
    let table = SyndicationJob::table_name();
    let mut qb = QueryBuilder::<Postgres>::new(format!("UPDATE \"{table}\" SET state = "));
    Value::from(JobState::Skipped).push_bind(&mut qb);
    qb.push(", updated_at = ");
    Value::from(now_ms).push_bind(&mut qb);
    qb.push(
        ", dispatch_shard = NULL, engagement_shard = NULL, \
         dispatch_lock_id = NULL, lock_acquired_at = NULL",
    );
    finish_commit(qb, job, lock_id).await
}

async fn commit_published(
    job: &SyndicationJob,
    lock_id: &str,
    pubref: &PublishedRef,
    now_ms: i64,
) -> Result<()> {
    commit_published_with_body_len(job, lock_id, pubref, 0, now_ms).await
}

async fn commit_published_with_body_len(
    job: &SyndicationJob,
    lock_id: &str,
    pubref: &PublishedRef,
    body_len: i32,
    now_ms: i64,
) -> Result<()> {
    let now_secs = now_ms / 1000;
    let one_hour_later = now_secs + 3600;
    let engagement_shard = shard::shard_for(&job.post_id);

    let table = SyndicationJob::table_name();
    let mut qb = QueryBuilder::<Postgres>::new(format!("UPDATE \"{table}\" SET state = "));
    Value::from(JobState::Published).push_bind(&mut qb);
    qb.push(", external_post_id = ");
    Value::from(pubref.external_post_id.clone()).push_bind(&mut qb);
    qb.push(", external_post_url = ");
    Value::from(pubref.external_post_url.clone()).push_bind(&mut qb);
    qb.push(", body_snapshot_len = ");
    Value::from(body_len).push_bind(&mut qb);
    qb.push(", engagement_shard = ");
    Value::from(engagement_shard).push_bind(&mut qb);
    qb.push(", engagement_next_at = ");
    Value::from(one_hour_later).push_bind(&mut qb);
    qb.push(", updated_at = ");
    Value::from(now_ms).push_bind(&mut qb);
    qb.push(", dispatch_shard = NULL, dispatch_lock_id = NULL, lock_acquired_at = NULL");
    finish_commit(qb, job, lock_id).await
}

/// Commit a terminal Failed state. The row stays in the panel with
/// `last_error_*` populated so the user's "Retry now" CTA can flip it back to
/// Pending; the inbox notification (`notify_failure`) is the user-visible
/// signal.
async fn commit_failed(
    job: &SyndicationJob,
    lock_id: &str,
    category: ErrorCategory,
    message: &str,
    new_attempts: i32,
    now_ms: i64,
) -> Result<()> {
    let table = SyndicationJob::table_name();
    let mut qb = QueryBuilder::<Postgres>::new(format!("UPDATE \"{table}\" SET state = "));
    Value::from(JobState::Failed).push_bind(&mut qb);
    qb.push(", attempts = ");
    Value::from(new_attempts).push_bind(&mut qb);
    qb.push(", last_error_category = ");
    Value::from(category).push_bind(&mut qb);
    qb.push(", last_error_message = ");
    Value::from(message.to_string()).push_bind(&mut qb);
    qb.push(", updated_at = ");
    Value::from(now_ms).push_bind(&mut qb);
    qb.push(
        ", dispatch_shard = NULL, engagement_shard = NULL, \
         dispatch_lock_id = NULL, lock_acquired_at = NULL",
    );
    finish_commit(qb, job, lock_id).await
}

/// Best-effort inbox notification for the post author. Errors here MUST NOT
/// block dispatch — the row state is already correct, the worst case is the
/// user not seeing the bell ring.
async fn notify_failure(
    _cli: &aws_sdk_dynamodb::Client,
    job: &SyndicationJob,
    category: ErrorCategory,
    error_message: Option<String>,
) {
    let post_id = job.post_id.clone();
    let cta_url = format!("/posts/{}", post_id);

    let payload = InboxPayload::CrossPostingFailed {
        post_id,
        platform: job.platform,
        error_category: category,
        error_message,
        cta_url,
    };

    // `author_user_id` is the bare user id; the inbox entity keys on the full
    // `Partition::User(..)` (cross-feature auth entity).
    let inbox = UserInboxNotification::new(Partition::User(job.author_user_id.clone()), payload);
    if let Err(e) = inbox.create().await {
        tracing::warn!(
            post_id = %job.post_id,
            error = %e,
            "dispatcher: inbox notification failed (non-fatal)"
        );
    }
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

fn build_link_card(post: &Post, job: &SyndicationJob) -> LinkCard {
    let stripped = post.body.0.to_plain_text();
    let description: String = stripped.chars().take(200).collect();
    LinkCard {
        backlink_url: job.backlink_url.clone(),
        fallback_title: post.title.clone(),
        fallback_description: description,
        fallback_thumb_url: post.urls.0.first().cloned(),
    }
}

fn classify_platform_error(err: &PlatformError) -> ErrorCategory {
    match err {
        PlatformError::AuthExpired(_) => ErrorCategory::AuthExpired,
        PlatformError::RateLimited(_) => ErrorCategory::RateLimited,
        PlatformError::ContentRejected(_) => ErrorCategory::ContentRejected,
        PlatformError::NetworkError(_) => ErrorCategory::NetworkError,
        PlatformError::Unknown(_) => ErrorCategory::Unknown,
    }
}

fn is_retryable(category: ErrorCategory) -> bool {
    matches!(
        category,
        ErrorCategory::RateLimited | ErrorCategory::NetworkError | ErrorCategory::Unknown
    )
}

/// AEAD-seal rotated credentials and persist them onto
/// `SocialConnection.credential_ciphertext`. Platform-agnostic: the actual
/// refresh call lives on `CrossPostAdapter::try_refresh_credentials`.
async fn persist_refreshed_credentials(
    connection: &SocialConnection,
    new_creds: &DecryptedCredentials,
) -> std::result::Result<(), PlatformError> {
    let sealed = credentials::seal_credentials(new_creds)
        .map_err(|e| PlatformError::Unknown(format!("seal after refresh failed: {e}")))?;

    SocialConnection::repository()
        .update(
            connection.id,
            SocialConnection::update()
                .credential_ciphertext(CredentialCiphertext(sealed))
                .updated_at(time::now()),
        )
        .await
        .map_err(|e| {
            PlatformError::Unknown(format!("SocialConnection update after refresh: {e}"))
        })?;

    Ok(())
}
