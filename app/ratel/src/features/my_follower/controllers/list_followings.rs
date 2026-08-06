#[cfg(feature = "server")]
use crate::common::models::auth::UserFollow;
use crate::features::my_follower::controllers::dto::FollowUserItem;
use crate::features::my_follower::controllers::profile::build_profiles;
use crate::features::my_follower::*;
use std::str::FromStr;

/// Rows per page. Matches the old DynamoDB query's `limit(10)`.
const PAGE_SIZE: i64 = 10;

#[get("/api/my-follower/followings?bookmark", user: crate::features::auth::User)]
pub async fn list_followings(bookmark: Option<String>) -> Result<ListResponse<FollowUserItem>> {
    let user_pk = user.pk();

    // `bookmark` carries the next 1-based page number as an opaque string —
    // the client treats it as an opaque cursor, so this is a transparent
    // swap of the DynamoDB cursor for a Postgres page number.
    let page: i64 = bookmark
        .as_deref()
        .and_then(|b| b.parse().ok())
        .filter(|p| *p >= 1)
        .unwrap_or(1);

    let page_result = UserFollow::list_followings_page(&user_pk, page, PAGE_SIZE).await?;
    let next_bookmark = if page < page_result.total_pages {
        Some((page + 1).to_string())
    } else {
        None
    };

    let target_pks: Vec<Partition> = page_result
        .items
        .into_iter()
        .filter_map(|follow| Partition::from_str(&follow.target_user_pk).ok())
        .collect();

    let profiles = build_profiles(&target_pks).await?;

    let items = target_pks
        .into_iter()
        .filter_map(|pk| {
            let key = pk.to_string();
            profiles.get(&key).map(|profile| FollowUserItem {
                user_pk: pk,
                display_name: profile.display_name.clone(),
                profile_url: profile.profile_url.clone(),
                username: profile.username.clone(),
                user_type: profile.user_type,
                description: profile.description.clone(),
                is_following: true,
            })
        })
        .collect();

    Ok(ListResponse {
        items,
        bookmark: next_bookmark,
    })
}
