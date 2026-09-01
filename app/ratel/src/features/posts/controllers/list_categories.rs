use crate::features::posts::controllers::dto::*;
#[cfg(feature = "server")]
use crate::features::posts::models::Category;
use crate::*;

#[get("/api/categories?bookmark")]
pub async fn list_categories_handler(
    bookmark: Option<String>,
) -> Result<ListItemsResponse<CategoryResponse>> {
    // `bookmark` carries an opaque 1-based page number (Postgres pagination).
    let page: i64 = bookmark
        .as_deref()
        .and_then(|b| b.parse::<i64>().ok())
        .filter(|p| *p >= 1)
        .unwrap_or(1);

    let result = Category::list(page, 100).await?;
    let next_bookmark = if page < result.total_pages {
        Some((page + 1).to_string())
    } else {
        None
    };
    Ok(ListItemsResponse {
        items: result
            .items
            .into_iter()
            .map(CategoryResponse::from)
            .collect(),
        bookmark: next_bookmark,
    })
}