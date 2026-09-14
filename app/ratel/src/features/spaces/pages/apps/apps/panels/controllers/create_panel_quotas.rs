use crate::features::spaces::pages::apps::apps::panels::*;
use crate::features::spaces::pages::apps::types::SpaceAppError;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct CreatePanelQuotaRequest {
    #[serde(default)]
    pub attributes: Vec<PanelAttributeWithQuota>,
    #[serde(default)]
    pub attributes_vec: Vec<CreatePanelQuotaGroupRequest>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct CreatePanelQuotaGroupRequest {
    pub attributes_vec: Vec<PanelAttribute>,
    pub quota: i64,
}

#[post("/api/spaces/{space_id}/panels", role: SpaceUserRole)]
pub async fn create_panel_quotas(
    space_id: SpacePartition,
    req: CreatePanelQuotaRequest,
) -> crate::common::Result<Vec<SpacePanelQuotaResponse>> {
    SpacePanelQuota::can_edit(role)?;

    let space_pk: Partition = space_id.into();

    let mut panels: Vec<SpacePanelQuota> = req
        .attributes
        .into_iter()
        .map(|attribute| (space_pk.clone(), attribute).into())
        .collect();
    panels.extend(req.attributes_vec.into_iter().map(|group| {
        SpacePanelQuota::new_with_attributes_vec(
            space_pk.clone(),
            group.quota,
            group.attributes_vec,
        )
    }));

    // Atomic all-or-nothing insert (mirrors the original DynamoDB
    // `transact_write_items!` create batch).
    let tx = postgres::Tx::begin()
        .await
        .map_err(crate::common::Error::from)?;
    for panel in &panels {
        SpacePanelQuota::repository()
            .with_tx(&tx)
            .insert(panel)
            .await
            .map_err(|e| {
                crate::error!("Failed to create panel quotas: {e}");
                SpaceAppError::PanelQuotaCreateFailed
            })?;
    }
    tx.commit().await.map_err(crate::common::Error::from)?;

    Ok(panels.into_iter().map(Into::into).collect())
}
