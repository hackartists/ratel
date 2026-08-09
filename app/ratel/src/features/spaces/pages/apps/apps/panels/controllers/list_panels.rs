use crate::features::spaces::pages::apps::apps::panels::*;

#[get("/api/spaces/{space_id}/panels", role: SpaceUserRole)]
pub async fn list_panels(
    space_id: SpacePartition,
) -> crate::common::Result<Vec<SpacePanelQuotaResponse>> {
    SpacePanelQuota::can_view(role)?;

    let space_pk: Partition = space_id.into();

    let panels = SpacePanelQuota::list_by_space(&space_pk).await?;

    Ok(panels
        .into_iter()
        .filter(|panel| !matches!(panel.attributes, PanelAttribute::None))
        .map(Into::into)
        .collect())
}
