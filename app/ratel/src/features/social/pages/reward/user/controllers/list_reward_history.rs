use super::super::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct RewardHistoryItem {
    pub created_at: i64,
    pub point: i64,
    pub space_title: Option<String>,
    pub action_name: Option<String>,
    pub transaction_id: Option<String>,
}

pub type ListRewardHistoryResponse = ListResponse<RewardHistoryItem>;

#[cfg(feature = "server")]
fn split_description(description: Option<String>) -> Option<String> {
    // Migration writes `description = "{space_pk}#{space_title}"`. Split on
    // the first `#` and take the tail as the human-readable title. Fall back
    // to the raw string when no separator exists (legacy rows written before
    // the migration that only carried the title).
    description.and_then(|d| {
        if let Some(idx) = d.find('#') {
            let title = &d[idx + 1..];
            if title.is_empty() {
                None
            } else {
                Some(title.to_string())
            }
        } else if d.is_empty() {
            None
        } else {
            Some(d)
        }
    })
}

/// Resolve `username` to either a User pk or a Team pk. Used so the
/// rewards-history endpoint can serve both `/{user}/rewards` and
/// `/{team}/team-rewards` from the same code path — the underlying
/// `UserRewardHistory` rows are keyed by either `USER#…##REWARD` or
/// `TEAM#…##REWARD`, so once we know the partition kind the GSI query
/// is identical.
///
/// Reuses `WallUser::find_by_username` (the same lookup
/// `get_wall_by_username` uses) so user/team disambiguation stays in
/// one place.
#[cfg(feature = "server")]
async fn resolve_target_pk(username: &str) -> Result<Partition> {
    use crate::features::social::controllers::WallUser;

    let candidates = WallUser::find_by_username(username.to_string())
        .await
        .map_err(|e| {
            crate::error!("WallUser::find_by_username failed for {username}: {e}");
            Error::NotFound(format!("lookup failed for username: {username}"))
        })?;

    candidates
        .into_iter()
        .next()
        .map(|w| match w {
            WallUser::User(u) => u.pk(),
            WallUser::Team(t) => t.partition(),
        })
        .ok_or_else(|| {
            Error::NotFound(format!("no user or team found for username: {username}"))
        })
}

#[get("/api/users/reward-history?username&bookmark")]
pub async fn list_reward_history_handler(
    username: String,
    bookmark: Option<String>,
) -> Result<ListRewardHistoryResponse> {
    use crate::common::models::reward::UserRewardHistory;

    let target_pk = resolve_target_pk(&username).await?;

    // `bookmark` carries an opaque 1-based page number as a string (same
    // convention as the DynamoDB `opt_with_bookmark` this replaces).
    const PAGE_SIZE: i64 = 10;
    let page: i64 = bookmark
        .as_deref()
        .and_then(|b| b.parse::<i64>().ok())
        .filter(|p| *p >= 1)
        .unwrap_or(1);

    let page_result = UserRewardHistory::find_by_target(&target_pk, page, PAGE_SIZE)
        .await
        .map_err(|e| {
            crate::error!("failed to query UserRewardHistory by user: {e}");
            Error::NotFound("failed to list reward history".to_string())
        })?;

    let next_bookmark = if page < page_result.total_pages {
        Some((page + 1).to_string())
    } else {
        None
    };

    let items: Vec<RewardHistoryItem> = page_result
        .items
        .into_iter()
        .map(|h| RewardHistoryItem {
            created_at: h.created_at,
            point: h.point,
            space_title: split_description(h.description),
            action_name: h.action_name,
            transaction_id: h.transaction_id,
        })
        .collect();

    Ok((items, next_bookmark).into())
}
