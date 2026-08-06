use crate::features::posts::controllers::dto::*;
#[cfg(feature = "server")]
use crate::features::posts::models::Category;
use crate::*;

#[delete("/api/categories/:name")]
pub async fn delete_category_handler(name: String) -> Result<CategoryResponse> {
    Category::delete_by_name(name.clone()).await?;
    Ok(CategoryResponse { name })
}