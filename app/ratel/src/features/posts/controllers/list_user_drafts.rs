use crate::features::auth::User;
use crate::features::posts::controllers::dto::*;
use crate::features::posts::models::*;
use crate::features::posts::types::*;
use crate::features::posts::*;

#[cfg(feature = "server")]
fn bookmark_to_page(bookmark: &Option<String>) -> i64 {
    bookmark
        .as_deref()
        .and_then(|b| b.parse::<i64>().ok())
        .filter(|p| *p >= 1)
        .unwrap_or(1)
}

#[cfg(feature = "server")]
fn next_bookmark(page: i64, total_pages: i64) -> Option<String> {
    if page < total_pages {
        Some((page + 1).to_string())
    } else {
        None
    }
}

#[get("/api/posts/drafts?bookmark", user: User)]
pub async fn list_user_drafts_handler(
    bookmark: Option<String>,
) -> Result<ListItemsResponse<PostResponse>> {
    tracing::debug!("list_user_drafts_handler: bookmark = {:?}", bookmark);

    let page = bookmark_to_page(&bookmark);
    let result =
        Post::find_by_user_and_status(&user.pk(), PostStatus::Draft, None, page, 10).await?;
    let bookmark = next_bookmark(page, result.total_pages);
    let posts = result.items;

    tracing::debug!(
        "list_user_drafts_handler: found {} drafts, next bookmark = {:?}",
        posts.len(),
        bookmark
    );

    let items: Vec<PostResponse> = posts.into_iter().map(PostResponse::from).collect();

    Ok(ListItemsResponse { items, bookmark })
}

#[get("/api/teams/:teamname/drafts?bookmark", _user: User)]
pub async fn list_team_drafts_handler(
    teamname: String,
    bookmark: Option<String>,
) -> Result<ListItemsResponse<PostResponse>> {
    tracing::debug!("list_team_drafts_handler: bookmark = {:?}", bookmark);

    let team = Team::find_by_username(&teamname)
        .await?
        .ok_or(Error::NotFound(format!("Team not found: {}", teamname)))?;
    let team_pk = team.partition();

    let page = bookmark_to_page(&bookmark);
    let result =
        Post::find_by_user_and_status(&team_pk, PostStatus::Draft, None, page, 10).await?;
    let bookmark = next_bookmark(page, result.total_pages);
    let posts = result.items;

    let items: Vec<PostResponse> = posts.into_iter().map(PostResponse::from).collect();

    Ok(ListItemsResponse { items, bookmark })
}
