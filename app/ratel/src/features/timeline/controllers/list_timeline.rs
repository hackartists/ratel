use crate::features::posts::controllers::dto::PostResponse;
use crate::features::posts::models::*;
use crate::features::timeline::controllers::dto::*;
use crate::features::timeline::models::*;
use crate::features::timeline::*;
use crate::features::timeline::types::TimelineError;
#[cfg(feature = "server")]
use postgres::PostgresEntity;

/// Query a single timeline category.
///
/// `GET /api/timeline?category=following&bookmark=...`
#[get("/api/timeline?category&bookmark", user: crate::features::auth::User)]
pub async fn list_timeline_handler(
    category: String,
    bookmark: Option<String>,
) -> Result<TimelineCategoryRow> {
    let reason: TimelineReason = category
        .parse()
        .map_err(|_e: String| TimelineError::InvalidBookmark)?;

    let user_id = match user.pk() {
        Partition::User(id) => id,
        _ => {
            return Err(TimelineError::InvalidUser.into());
        }
    };

    fetch_category_row(&user_id, &reason, &user, bookmark, 10).await
}

/// Query all timeline categories with a preview of posts for each.
///
/// `GET /api/timeline/feed?preview_count=...`
///
/// Returns a Netflix-style layout with multiple rows, each containing
/// a preview of posts from a different category.
#[get("/api/timeline/feed?preview_count", user: crate::features::auth::User)]
pub async fn list_timeline_feed_handler(
    preview_count: Option<i32>,
) -> Result<TimelineFeedResponse> {
    let user_id = match user.pk() {
        Partition::User(id) => id,
        _ => {
            return Err(TimelineError::InvalidUser.into());
        }
    };

    let limit = preview_count.unwrap_or(5).min(20);
    let mut categories = Vec::new();

    for reason in TIMELINE_CATEGORIES {
        match fetch_category_row(&user_id, reason, &user, None, limit).await {
            Ok(row) if !row.items.is_empty() => {
                categories.push(row);
            }
            Ok(_) => {} // empty category, skip
            Err(e) => {
                tracing::warn!("Failed to fetch category {}: {}", reason, e);
            }
        }
    }

    Ok(TimelineFeedResponse { categories })
}

/// Fetch one category row.
///
/// Timeline entries and the referenced posts / like status are all Postgres-
/// backed now, so this reads entirely off the global connection pool — no
/// `aws_sdk_dynamodb::Client` needed.
///
/// `bookmark` carries an opaque page number (1-based) as a string; the next
/// bookmark is `page + 1` while more pages remain.
#[cfg(feature = "server")]
async fn fetch_category_row(
    user_id: &str,
    reason: &TimelineReason,
    user: &crate::features::auth::User,
    bookmark: Option<String>,
    limit: i32,
) -> Result<TimelineCategoryRow> {
    use postgres::Order;
    use postgres::ops::{EnumOp, StringOp};

    let page: i64 = bookmark
        .as_deref()
        .and_then(|b| b.parse::<i64>().ok())
        .filter(|p| *p >= 1)
        .unwrap_or(1);

    let result = TimelineEntry::repository()
        .find(
            TimelineEntry::query()
                .user_id(StringOp::Eq(user_id.to_string()))
                .reason(EnumOp::Eq(*reason))
                .order_by(TimelineEntryColumn::CreatedAt, Order::Desc)
                .page_size(limit as i64)
                .page(page),
        )
        .await
        .map_err(|e| {
            crate::error!("timeline query failed: {e}");
            crate::common::Error::Internal
        })?;

    let entries = result.items;
    let has_more = page < result.total_pages;
    let next_bookmark = if has_more {
        Some((page + 1).to_string())
    } else {
        None
    };

    if entries.is_empty() {
        return Ok(TimelineCategoryRow {
            category: reason.to_string(),
            items: vec![],
            bookmark: next_bookmark,
            has_more,
        });
    }

    // Batch get the actual posts (deduplicate ids).
    let mut seen = std::collections::HashSet::new();
    let post_uuids: Vec<uuid::Uuid> = entries
        .iter()
        .filter(|entry| seen.insert(entry.post_id.clone()))
        .filter_map(|entry| uuid::Uuid::parse_str(&entry.post_id).ok())
        .collect();

    let posts = Post::get_many(post_uuids).await?;

    // Maintain timeline ordering — `get_many` doesn't preserve it.
    let post_map: std::collections::HashMap<String, Post> =
        posts.into_iter().map(|p| (p.feed_id(), p)).collect();

    let mut seen_posts = std::collections::HashSet::new();
    let ordered_posts: Vec<Post> = entries
        .iter()
        .filter(|entry| seen_posts.insert(entry.post_id.clone()))
        .filter_map(|entry| post_map.get(&entry.post_id).cloned())
        .collect();

    // Get like status for the user in one indexed query.
    let liked_ids = if !ordered_posts.is_empty() {
        PostLike::liked_post_ids(&user.pk(), ordered_posts.iter().map(|p| p.id).collect())
            .await
            .unwrap_or_default()
    } else {
        Default::default()
    };

    let items: Vec<PostResponse> = ordered_posts
        .into_iter()
        .map(|post| {
            let liked = liked_ids.contains(&post.id);
            PostResponse::from(post).with_like(liked)
        })
        .collect();

    Ok(TimelineCategoryRow {
        category: reason.to_string(),
        items,
        bookmark: next_bookmark,
        has_more,
    })
}
