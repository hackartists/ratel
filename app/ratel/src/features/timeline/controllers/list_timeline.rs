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
    let conf = crate::features::posts::config::get();
    let cli = conf.dynamodb();

    let reason: TimelineReason = category
        .parse()
        .map_err(|_e: String| TimelineError::InvalidBookmark)?;

    let user_id = match &user.pk {
        Partition::User(id) => id.clone(),
        _ => {
            return Err(TimelineError::InvalidUser.into());
        }
    };

    fetch_category_row(cli, &user_id, &reason, &user, bookmark, 10).await
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
    let conf = crate::features::posts::config::get();
    let cli = conf.dynamodb();

    let user_id = match &user.pk {
        Partition::User(id) => id.clone(),
        _ => {
            return Err(TimelineError::InvalidUser.into());
        }
    };

    let limit = preview_count.unwrap_or(5).min(20);
    let mut categories = Vec::new();

    for reason in TIMELINE_CATEGORIES {
        match fetch_category_row(cli, &user_id, reason, &user, None, limit).await {
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
/// Timeline entries live in Postgres (queried by `(user_id, reason)`, newest
/// first, page-paginated). The referenced posts and the caller's like status
/// are still read from DynamoDB via batch gets — those entities are owned by
/// the `posts` feature and are unchanged here, so `cli` is retained solely for
/// them.
///
/// `bookmark` carries an opaque page number (1-based) as a string; the next
/// bookmark is `page + 1` while more pages remain.
#[cfg(feature = "server")]
async fn fetch_category_row(
    cli: &aws_sdk_dynamodb::Client,
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

    // Batch get the actual posts (deduplicate keys for BatchGetItem)
    let mut seen = std::collections::HashSet::new();
    let post_keys: Vec<(Partition, EntityType)> = entries
        .iter()
        .filter(|entry| seen.insert(entry.post_id.clone()))
        .map(|entry| (Partition::Feed(entry.post_id.clone()), EntityType::Post))
        .collect();

    let posts = Post::batch_get(cli, post_keys).await?;

    // Maintain timeline ordering
    let post_map: std::collections::HashMap<String, Post> =
        posts.into_iter().map(|p| (p.pk.to_string(), p)).collect();

    // Get like status for the user (deduplicate)
    let mut seen_posts = std::collections::HashSet::new();
    let ordered_posts: Vec<Post> = entries
        .iter()
        .filter(|entry| seen_posts.insert(entry.post_id.clone()))
        .filter_map(|entry| {
            let post_pk = Partition::Feed(entry.post_id.clone());
            post_map.get(&post_pk.to_string()).cloned()
        })
        .collect();

    let likes = if !ordered_posts.is_empty() {
        let mut seen_likes = std::collections::HashSet::new();
        let like_keys: Vec<_> = ordered_posts
            .iter()
            .filter(|post| seen_likes.insert(post.pk.to_string()))
            .map(|post| PostLike::keys(&post.pk, &user.pk))
            .collect();
        PostLike::batch_get(cli, like_keys).await.unwrap_or_default()
    } else {
        vec![]
    };

    let items: Vec<PostResponse> = ordered_posts
        .into_iter()
        .map(|post| {
            let post_like_pk = post
                .pk
                .clone()
                .to_post_like_key()
                .expect("to_post_like_key");
            let liked = likes.iter().any(|like| like.pk == post_like_pk);
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
