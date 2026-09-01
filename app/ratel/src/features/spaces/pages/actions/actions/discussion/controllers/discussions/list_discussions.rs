use crate::features::spaces::pages::actions::actions::discussion::*;

#[get("/api/spaces/{space_id}/discussions?category&bookmark", role: SpaceUserRole)]
pub async fn list_discussions(
    space_id: SpacePartition,
    category: Option<String>,
    bookmark: Option<String>,
) -> Result<ListResponse<SpacePost>> {
    SpacePost::can_view(&role)?;

    let (posts, next_bookmark) =
        SpacePost::list_by_space(&space_id, category, bookmark, 20).await?;

    Ok(ListResponse {
        bookmark: next_bookmark,
        items: posts,
    })
}
