use crate::features::spaces::pages::apps::apps::panels::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct UpdatePanelQuotaRequest {
    pub panel_id: SpacePanelAttributeEntityType,
    pub quota: i64,
}

#[patch("/api/spaces/{space_id}/panels", role: SpaceUserRole)]
pub async fn update_panel_quota(
    space_id: SpacePartition,
    req: UpdatePanelQuotaRequest,
) -> crate::common::Result<SpacePanelQuotaResponse> {
    use postgres::PostgresEntity;

    SpacePanelQuota::can_edit(role)?;

    let space_pk: Partition = space_id.into();
    let panel_sk: EntityType = req.panel_id.into();
    let (attribute_label, attribute_value) = match panel_sk {
        EntityType::SpacePanelAttribute(label, value) => (label, value),
        _ => (String::new(), String::new()),
    };

    let existing = SpacePanelQuota::get_by_attr(&space_pk, &attribute_label, &attribute_value)
        .await?
        .ok_or(Error::NotFound("Panel quota not found".to_string()))?;

    let panel = SpacePanelQuota::repository()
        .update(
            existing.id,
            SpacePanelQuota::update()
                .quotas(req.quota)
                .remains(req.quota),
        )
        .await
        .map_err(crate::common::Error::from)?;

    Ok(panel.into())
}
