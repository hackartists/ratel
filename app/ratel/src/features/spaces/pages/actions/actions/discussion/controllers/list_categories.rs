use crate::features::spaces::pages::actions::actions::discussion::*;

#[get("/api/spaces/{space_id}/discussions/categories", role: SpaceUserRole)]
pub async fn list_categories(space_id: SpacePartition) -> Result<Vec<String>> {
    SpacePost::can_view(&role)?;

    let names = SpaceCategory::list_names(&space_id).await?;

    Ok(names)
}
