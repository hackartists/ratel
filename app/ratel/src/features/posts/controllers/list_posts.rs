use crate::features::auth::OptionalUser;
use crate::features::posts::controllers::dto::*;
use crate::features::posts::models::*;
use crate::features::posts::types::*;
use crate::features::posts::*;

#[cfg(feature = "server")]
use crate::features::timeline::models::{TimelineEntry, TimelineEntryColumn};
#[cfg(feature = "server")]
use base64::Engine;
#[cfg(feature = "server")]
use postgres::PostgresEntity;

#[cfg(feature = "server")]
fn serializable_post_error(context: &str, err: Error) -> Error {
    match err {
        Error::Aws(ref inner) => {
            crate::error!("{context}: {inner}");
            PostError::ListFailed.into()
        }
        Error::Session(ref inner) => {
            crate::error!("{context}: {inner}");
            PostError::ListFailed.into()
        }
        other => other,
    }
}

#[cfg(feature = "server")]
const TIMELINE_BOOKMARK_PREFIX: &str = "timeline:";
#[cfg(feature = "server")]
const GLOBAL_BOOKMARK_PREFIX: &str = "global:";

#[cfg(feature = "server")]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum PostFeedSource {
    Timeline,
    Global,
}

#[cfg(feature = "server")]
fn parse_post_feed_bookmark(bookmark: Option<String>) -> (PostFeedSource, Option<String>) {
    match bookmark {
        Some(bookmark) if bookmark.starts_with(TIMELINE_BOOKMARK_PREFIX) => (
            PostFeedSource::Timeline,
            Some(bookmark[TIMELINE_BOOKMARK_PREFIX.len()..].to_string()),
        ),
        Some(bookmark) if bookmark.starts_with(GLOBAL_BOOKMARK_PREFIX) => (
            PostFeedSource::Global,
            Some(bookmark[GLOBAL_BOOKMARK_PREFIX.len()..].to_string()),
        ),
        Some(bookmark) => {
            let inferred_source = base64::engine::general_purpose::URL_SAFE_NO_PAD
                .decode(&bookmark)
                .ok()
                .and_then(|decoded| String::from_utf8(decoded).ok())
                .map(|decoded| {
                    if decoded.contains("gsi6_pk") {
                        PostFeedSource::Global
                    } else {
                        PostFeedSource::Timeline
                    }
                })
                .unwrap_or(PostFeedSource::Timeline);

            (inferred_source, Some(bookmark))
        }
        None => (PostFeedSource::Timeline, None),
    }
}

#[cfg(feature = "server")]
fn format_post_feed_bookmark(source: PostFeedSource, bookmark: Option<String>) -> Option<String> {
    bookmark.map(|bookmark| match source {
        PostFeedSource::Timeline => format!("{TIMELINE_BOOKMARK_PREFIX}{bookmark}"),
        PostFeedSource::Global => format!("{GLOBAL_BOOKMARK_PREFIX}{bookmark}"),
    })
}

#[mcp_tool(name = "list_posts", description = "List posts from the feed.")]
#[get("/api/posts?bookmark", user: OptionalUser)]
pub async fn list_posts_handler(
    bookmark: Option<String>,
) -> Result<ListItemsResponse<PostResponse>> {
    let conf = crate::features::posts::config::get();
    let cli = conf.dynamodb();

    let user: Option<crate::features::auth::User> = user.into();

    tracing::debug!(
        "list_posts_handler: user = {:?} bookmark = {:?}",
        user,
        bookmark
    );

    let _ = cli;
    let (bookmark_source, bookmark) = parse_post_feed_bookmark(bookmark);

    let (feed_source, posts, bookmark) = if let Some(ref user) = user {
        match bookmark_source {
            PostFeedSource::Timeline => fetch_timeline_posts(user, bookmark)
                .await
                .map_err(|err| serializable_post_error("Failed to load personalized feed", err))?,
            PostFeedSource::Global => {
                let (posts, bookmark) = fetch_global_posts(bookmark)
                    .await
                    .map_err(|err| serializable_post_error("Failed to load public feed", err))?;
                (PostFeedSource::Global, posts, bookmark)
            }
        }
    } else {
        let (posts, bookmark) = fetch_global_posts(bookmark)
            .await
            .map_err(|err| serializable_post_error("Failed to load public feed", err))?;
        (PostFeedSource::Global, posts, bookmark)
    };

    let liked_ids = match (&user, posts.is_empty()) {
        (Some(user), false) => {
            let post_ids: Vec<uuid::Uuid> = posts.iter().map(|p| p.id).collect();
            PostLike::liked_post_ids(&user.pk(), post_ids)
                .await
                .map_err(|err| serializable_post_error("Failed to load post likes", err))?
        }
        _ => Default::default(),
    };

    tracing::debug!("list_posts_handler: returning {} items", posts.len());
    let items: Vec<PostResponse> = posts
        .into_iter()
        .map(|post| {
            let liked = liked_ids.contains(&post.id);
            PostResponse::from(post).with_like(liked)
        })
        .collect();

    Ok(ListItemsResponse {
        items,
        bookmark: format_post_feed_bookmark(feed_source, bookmark),
    })
}

/// Fetch posts from the user's personalized timeline.
/// Falls back to global feed if the timeline is empty.
#[cfg(feature = "server")]
async fn fetch_timeline_posts(
    user: &crate::features::auth::User,
    bookmark: Option<String>,
) -> Result<(PostFeedSource, Vec<Post>, Option<String>)> {
    let user_pk = user.pk();
    let user_id = match &user_pk {
        Partition::User(id) => id.clone(),
        _ => {
            let (posts, bookmark) = fetch_global_posts(bookmark).await?;
            return Ok((PostFeedSource::Global, posts, bookmark));
        }
    };

    use postgres::Order;
    use postgres::ops::StringOp;

    // `bookmark` carries an opaque 1-based page number as a string (Postgres
    // page pagination). All categories are queried together (no reason filter),
    // newest first.
    let page: i64 = bookmark
        .as_deref()
        .and_then(|b| b.parse::<i64>().ok())
        .filter(|p| *p >= 1)
        .unwrap_or(1);

    let result = TimelineEntry::repository()
        .find(
            TimelineEntry::query()
                .user_id(StringOp::Eq(user_id.clone()))
                .order_by(TimelineEntryColumn::CreatedAt, Order::Desc)
                .page_size(10)
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

    if entries.is_empty() && next_bookmark.is_none() {
        // No timeline entries yet — fall back to global feed
        let (posts, bookmark) = fetch_global_posts(None).await?;
        return Ok((PostFeedSource::Global, posts, bookmark));
    }

    if entries.is_empty() {
        return Ok((PostFeedSource::Timeline, vec![], next_bookmark));
    }

    // Batch get the actual posts (dedup + parse feed ids to UUID).
    let mut seen = std::collections::HashSet::new();
    let post_ids: Vec<uuid::Uuid> = entries
        .iter()
        .filter(|entry| seen.insert(entry.post_id.clone()))
        .filter_map(|entry| uuid::Uuid::parse_str(&entry.post_id).ok())
        .collect();

    let posts = Post::get_many(post_ids).await?;

    // Maintain timeline ordering by mapping posts by feed id (id.to_string()).
    let post_map: std::collections::HashMap<String, Post> =
        posts.into_iter().map(|p| (p.id.to_string(), p)).collect();

    let mut seen_posts = std::collections::HashSet::new();
    let ordered_posts: Vec<Post> = entries
        .iter()
        .filter(|entry| seen_posts.insert(entry.post_id.clone()))
        .filter_map(|entry| post_map.get(&entry.post_id).cloned())
        .collect();

    Ok((PostFeedSource::Timeline, ordered_posts, next_bookmark))
}

/// Fetch posts from the global public feed (Published + Public).
#[cfg(feature = "server")]
async fn fetch_global_posts(bookmark: Option<String>) -> Result<(Vec<Post>, Option<String>)> {
    let page: i64 = bookmark
        .as_deref()
        .and_then(|b| b.parse::<i64>().ok())
        .filter(|p| *p >= 1)
        .unwrap_or(1);
    let result = Post::find_public_feed(page, 10).await?;
    let next_bookmark = if page < result.total_pages {
        Some((page + 1).to_string())
    } else {
        None
    };
    Ok((result.items, next_bookmark))
}
