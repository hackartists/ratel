//! Stats + leaderboard endpoints (PR7).
//!
//! Surface:
//!   GET /api/fact-or-fold/me/stats
//!   GET /api/fact-or-fold/leaderboard?bookmark
//!
//! `me/stats` returns the caller's `FactFoldUserStats` row.
//! `leaderboard` returns top-accuracy entries from the anchor pk
//! `Partition::FactFoldLeaderboard` (sk DESC, paginated via the
//! standard `ListResponse<T>` bookmark).

use crate::common::*;
use crate::features::arcade::games::fact_or_fold::types::*;

#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[cfg(feature = "server")]
use crate::common::models::auth::User;
#[cfg(feature = "server")]
use crate::features::arcade::games::fact_or_fold::models::{
    FactFoldLeaderboardEntry, FactFoldUserStats,
};
#[cfg(feature = "server")]
use std::str::FromStr;

const LEADERBOARD_PAGE_LIMIT: i32 = 50;

// ── GET /api/fact-or-fold/me/stats ──────────────────────────────────

#[get("/api/fact-or-fold/me/stats", user: User)]
pub async fn get_my_stats_handler() -> Result<UserStatsResponse> {
    let user_id = UserPartition::from(user.pk().clone()).0;
    let stats = FactFoldUserStats::get_or_default(&user_id)
        .await
        .map_err(|e| {
            crate::error!("get_my_stats_handler read failed: {e}");
            FactOrFoldError::StorageFailure
        })?;
    let accuracy_bps = if stats.total_rounds > 0 {
        ((stats.correct_count * 10_000) / stats.total_rounds).clamp(0, 10_000) as i32
    } else {
        0
    };
    Ok(UserStatsResponse {
        user_pk: UserPartition(user_id),
        total_rounds: stats.total_rounds,
        correct_count: stats.correct_count,
        accuracy_bps,
        lifetime_delta_chips: stats.lifetime_delta_chips,
        last_played_at: stats.last_played_at,
    })
}

// ── GET /api/fact-or-fold/leaderboard?bookmark ──────────────────────

#[get("/api/fact-or-fold/leaderboard?bookmark", _user: User)]
pub async fn get_leaderboard_handler(
    bookmark: Option<String>,
) -> Result<ListResponse<LeaderboardEntryResponse>> {
    // Offset-based pagination replaces the DynamoDB LEK bookmark.
    // `bookmark` carries the next row offset (stringified); ordering is
    // `accuracy_bps DESC` so the highest-accuracy users come first.
    let offset: i64 = bookmark
        .as_deref()
        .and_then(|b| b.parse::<i64>().ok())
        .unwrap_or(0)
        .max(0);
    let rows = FactFoldLeaderboardEntry::list_top(LEADERBOARD_PAGE_LIMIT as i64, offset)
        .await
        .map_err(|e| {
            crate::error!("get_leaderboard_handler query failed: {e}");
            FactOrFoldError::StorageFailure
        })?;
    let next_bookmark = if rows.len() as i32 == LEADERBOARD_PAGE_LIMIT {
        Some((offset + LEADERBOARD_PAGE_LIMIT as i64).to_string())
    } else {
        None
    };

    // Enrich each entry with the user's display metadata in a single
    // `WHERE id IN (...)` query so the response is one round-trip
    // regardless of page size (replaces the DynamoDB BatchGetItem).
    let user_ids: Vec<uuid::Uuid> = rows
        .iter()
        .filter_map(|e| Partition::from_str(&e.user_pk).ok())
        .filter_map(|pk| User::id_from_partition(&pk))
        .collect();
    let user_rows = if user_ids.is_empty() {
        Vec::new()
    } else {
        use postgres::PostgresEntity;
        use postgres::col::UuidCol;
        User::repository()
            .find(User::query().filter(|c| c.id.in_(user_ids)))
            .await
            .map_err(|err| {
                crate::error!("get_leaderboard_handler user batch load failed: {err}");
                FactOrFoldError::StorageFailure
            })?
            .items
    };
    // Key on the rendered `USER#{id}` string — matches the stored
    // `entry.user_pk`.
    let user_by_pk: std::collections::HashMap<String, User> = user_rows
        .into_iter()
        .map(|u| (u.pk().to_string(), u))
        .collect();

    let items: Vec<LeaderboardEntryResponse> = rows
        .into_iter()
        .map(|e| {
            let (username, display_name, profile_url) = user_by_pk
                .get(&e.user_pk)
                .map(|u| (u.username.clone(), u.display_name.clone(), u.profile_url.clone()))
                .unwrap_or_default();
            LeaderboardEntryResponse {
                user_pk: crate::features::arcade::games::fact_or_fold::types::dto::user_partition_from_pk(&e.user_pk),
                username,
                display_name,
                profile_url,
                accuracy_bps: e.accuracy_bps,
                total_rounds: e.total_rounds,
                correct_count: e.correct_count,
                lifetime_delta_chips: e.lifetime_delta_chips,
                last_played_at: e.last_played_at,
            }
        })
        .collect();
    Ok((items, next_bookmark).into())
}
