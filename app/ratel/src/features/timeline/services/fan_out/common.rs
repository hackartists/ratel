use std::collections::HashSet;

use crate::common::models::auth::UserFollow;
use crate::features::timeline::*;
use crate::features::timeline::models::{TimelineEntry, TimelineReason};

/// Collect all follower user_pks of `target_pk`, adding them to `entries` with a custom reason.
pub(super) async fn collect_followers_with_reason(
    cli: &aws_sdk_dynamodb::Client,
    target_pk: &Partition,
    seen: &mut HashSet<String>,
    entries: &mut Vec<(Partition, TimelineReason)>,
    reason: TimelineReason,
) -> Result<()> {
    let mut bookmark: Option<String> = None;
    loop {
        let mut opt = UserFollow::opt()
            .sk(EntityType::Follower(String::default()).to_string())
            .limit(100);
        if let Some(bk) = bookmark {
            opt = opt.bookmark(bk);
        }

        let (follows, next_bookmark) = UserFollow::query(cli, target_pk.clone(), opt).await?;
        for follow in follows {
            let key = follow.user_pk.to_string();
            if seen.insert(key) {
                entries.push((follow.user_pk, reason.clone()));
            }
        }

        bookmark = next_bookmark;
        if bookmark.is_none() {
            break;
        }
    }
    Ok(())
}

/// Collect follower PKs into `seen` without creating entries (for dedup purposes).
pub(super) async fn collect_follower_pks(
    cli: &aws_sdk_dynamodb::Client,
    target_pk: &Partition,
    seen: &mut HashSet<String>,
) -> Result<()> {
    let mut bookmark: Option<String> = None;
    loop {
        let mut opt = UserFollow::opt()
            .sk(EntityType::Follower(String::default()).to_string())
            .limit(100);
        if let Some(bk) = bookmark {
            opt = opt.bookmark(bk);
        }

        let (follows, next_bookmark) = UserFollow::query(cli, target_pk.clone(), opt).await?;
        for follow in follows {
            seen.insert(follow.user_pk.to_string());
        }

        bookmark = next_bookmark;
        if bookmark.is_none() {
            break;
        }
    }
    Ok(())
}

/// Write timeline entries to Postgres.
///
/// The DynamoDB version batched these into `transact_write_items` chunks of 25
/// purely for throughput — there was no cross-row atomicity requirement (each
/// entry is independent, keyed by `(user_id, created_at, post_id)`). Here each
/// entry is upserted on its natural key so a re-delivery of the same post to
/// the same user overwrites in place (updating `reason`/category), matching the
/// old pk/sk overwrite semantics exactly.
pub(super) async fn write_timeline_entries(
    post_pk: &Partition,
    author_pk: &Partition,
    created_at: i64,
    entries: &[(Partition, TimelineReason)],
) -> Result<()> {
    let repo = TimelineEntry::repository();
    for (user_pk, reason) in entries {
        let entry = TimelineEntry::new(user_pk, post_pk, author_pk, created_at, *reason);
        repo.upsert_on(&["user_id", "created_at", "post_id"], &entry)
            .await
            .map_err(|e| {
                crate::error!("Failed to write timeline entry: {e}");
                crate::features::timeline::types::TimelineError::FanOutFailed
            })?;
    }

    Ok(())
}
