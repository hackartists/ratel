//! HotSpace fanout. The only writer of `HotSpace` rows.
//!
//! Triggered after a Space mutation (publish, content edit, status change,
//! quota change, action create, XP record, etc.). Re-reads the current
//! SpaceCommon + Post + action counts, recomputes a `WindowedRankKey`
//! anchored at "now", and upserts the row.
//!
//! Eligibility for the Hot tab:
//! - Space must be Public+Published.
//! - Space must have at least `MIN_PARTICIPANTS_FOR_HOT` participants.
//!
//! Anything else has its row deleted so it disappears from
//! `list_hot_spaces` results. Every viewer sees the same `HSR#ALL` stream;
//! there is no per-viewer fanout.
//!
//! Best-effort: errors must not fail the user-facing mutation that triggered
//! us. Callers should ignore errors and rely on logging.

use crate::common::models::space::SpaceCommon;
use crate::common::types::*;
use crate::common::utils::time::get_now_timestamp_millis;
use crate::common::*;
use crate::features::posts::models::Post;
use crate::features::spaces::pages::actions::models::SpaceAction;
use crate::features::spaces::pages::actions::types::SpaceActionType;
use crate::features::spaces::space_common::models::{HOT_SPACE_RANK_PK, HotSpace, HotSpaceHeat};

/// 30-day windows. Newer windows always lex-sort above older windows, so
/// stale rows that never get re-fanout naturally fall out of the top.
const WINDOW_DAYS: u64 = 30;
const WINDOW_SIZE_SECS: u64 = WINDOW_DAYS * 24 * 60 * 60;

/// Hour resolution gives 720 freshness units per window. With multipliers
/// below, a single new participant offsets ~6 hours of decay.
const FRESHNESS_RESOLUTION: TimeBucket = TimeBucket::Hour;
const PARTICIPANT_MULTIPLIER: u64 = 6;
const ACTION_MULTIPLIER: u64 = 2;

/// Minimum participants required for a space to surface in the Hot tab.
/// Filters out empty/test spaces so the global stream stays signal-heavy.
pub const MIN_PARTICIPANTS_FOR_HOT: i64 = 10;

/// Re-snapshot a space's hot ranking. Idempotent; safe to call repeatedly.
///
/// - Public+Published spaces with `>= MIN_PARTICIPANTS_FOR_HOT` participants:
///   upsert the HotSpace row.
/// - Everything else (private, draft, low participation, missing): delete the
///   row. Best-effort; missing-row deletes are ignored.
pub async fn upsert_hot_space(_cli: &aws_sdk_dynamodb::Client, space_pk: &Partition) {
    // Bare space id — HotSpace is Postgres-backed and keyed by `space_id`.
    // SpaceCommon / Post / SpaceAction below are Postgres-backed too now, so
    // `_cli` is unused — kept for external caller compatibility.
    let space_id_str: String = {
        let sp: SpacePartition = space_pk.clone().into();
        sp.0
    };

    let space = match SpaceCommon::get_by_partition(space_pk).await {
        Ok(Some(s)) => s,
        Ok(None) => {
            // Space deleted — drop any stale row.
            let _ = HotSpace::delete_for_space(&space_id_str).await;
            return;
        }
        Err(e) => {
            crate::error!(
                space_pk = %space_pk,
                error = %e,
                "fanout: failed to load SpaceCommon"
            );
            return;
        }
    };

    if !space.is_public() || space.participants < MIN_PARTICIPANTS_FOR_HOT {
        if let Err(e) = HotSpace::delete_for_space(&space_id_str).await {
            crate::warn!(
                space_pk = %space_pk,
                error = %e,
                "fanout: HotSpace delete failed (likely missing — ignored)"
            );
        }
        return;
    }

    let space_partition = space.partition();
    let post_pk = space_partition.clone().to_post_key().unwrap_or_default();
    let post_uuid = match &post_pk {
        Partition::Feed(id) => uuid::Uuid::parse_str(id).ok(),
        _ => None,
    };
    let post = match post_uuid {
        Some(id) => Post::get_by_feed_id(id).await.ok().flatten(),
        None => None,
    };
    let title = post.map(|p| p.title).unwrap_or_default();

    let post_id: String = {
        let fp: FeedPartition = post_pk.into();
        fp.0
    };
    let description = if !space.content.is_empty() {
        extract_description(&space.content)
    } else {
        String::new()
    };

    let (poll_count, discussion_count, quiz_count, follow_count) =
        count_actions(&space_partition).await;
    let total_actions = poll_count + discussion_count + quiz_count + follow_count;

    let now_ms = get_now_timestamp_millis();
    let now_secs = (now_ms / 1000).max(0) as u64;

    let participants_u64 = space.participants.max(0) as u64;
    let actions_u64 = total_actions.max(0) as u64;

    let rank_key = WindowedRankKey::build(
        FRESHNESS_RESOLUTION,
        WINDOW_SIZE_SECS,
        now_secs,
        &[
            Factor::new(participants_u64, PARTICIPANT_MULTIPLIER),
            Factor::new(actions_u64, ACTION_MULTIPLIER),
        ],
    );

    let row = HotSpace {
        id: uuid::Uuid::now_v7(),
        space_id: space_id_str,
        created_at: now_ms,
        updated_at: now_ms,
        rank_pk: HOT_SPACE_RANK_PK.to_string(),
        rank_key: rank_key.to_string(),
        post_id,
        title,
        description,
        logo: space.logo.clone(),
        author_display_name: space.author_display_name.clone(),
        participants: space.participants,
        rewards: space.rewards.unwrap_or(0),
        poll_count,
        discussion_count,
        quiz_count,
        follow_count,
        total_actions,
        heat: HotSpaceHeat::from_participants(space.participants),
        space_created_at: space.created_at,
    };

    // Natural-key upsert on `space_id` preserves the surrogate `id` for an
    // existing row (mirrors the DynamoDB per-space singleton upsert).
    if let Err(e) = HotSpace::repository()
        .upsert_on(&["space_id"], &row)
        .await
    {
        crate::error!(
            space_pk = %space_pk,
            error = %e,
            "fanout: HotSpace upsert failed"
        );
    }
}

async fn count_actions(space_pk: &Partition) -> (i64, i64, i64, i64) {
    let space_id: SpacePartition = space_pk.clone().into();
    let actions = match SpaceAction::list_by_space(&space_id).await {
        Ok(actions) => actions,
        Err(_) => return (0, 0, 0, 0),
    };

    let mut polls = 0i64;
    let mut discussions = 0i64;
    let mut quizzes = 0i64;
    let mut follows = 0i64;
    for a in actions {
        match a.space_action_type {
            SpaceActionType::Poll => polls += 1,
            SpaceActionType::TopicDiscussion => discussions += 1,
            SpaceActionType::Quiz => quizzes += 1,
            SpaceActionType::Follow => follows += 1,
            SpaceActionType::Meet => {}
        }
    }
    (polls, discussions, quizzes, follows)
}

fn extract_description(html: &str) -> String {
    let re_img = regex::Regex::new(r"<img[^>]*>").unwrap();
    let without_images = re_img.replace_all(html, "");

    let re_tags = regex::Regex::new(r"<[^>]+>").unwrap();
    let without_tags = re_tags.replace_all(&without_images, "");

    let re_urls = regex::Regex::new(r"https?://[^\s]+").unwrap();
    let without_urls = re_urls.replace_all(&without_tags, "");

    let re_whitespace = regex::Regex::new(r"\s+").unwrap();
    re_whitespace
        .replace_all(&without_urls, " ")
        .trim()
        .to_string()
}
