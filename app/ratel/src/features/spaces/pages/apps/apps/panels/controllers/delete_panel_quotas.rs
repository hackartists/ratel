use crate::features::spaces::pages::apps::apps::panels::*;
use crate::features::spaces::pages::apps::types::SpaceAppError;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct DeletePanelKey {
    pub panel_id: SpacePanelAttributeEntityType,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct DeletePanelQuotaRequest {
    pub keys: Vec<DeletePanelKey>,
}

#[delete("/api/spaces/{space_id}/panels", role: SpaceUserRole)]
pub async fn delete_panel_quotas(
    space_id: SpacePartition,
    req: DeletePanelQuotaRequest,
) -> crate::common::Result<bool> {
    SpacePanelQuota::can_edit(role)?;

    let space_pk: Partition = space_id.into();

    // Atomic all-or-nothing delete (mirrors the original DynamoDB
    // `transact_write_items!` delete batch).
    let tx = postgres::Tx::begin()
        .await
        .map_err(crate::common::Error::from)?;
    for key in req.keys {
        let panel_sk: EntityType = key.panel_id.into();
        let (attribute_label, attribute_value) = match panel_sk {
            EntityType::SpacePanelAttribute(label, value) => (label, value),
            _ => continue,
        };
        if let Some(existing) =
            SpacePanelQuota::get_by_attr(&space_pk, &attribute_label, &attribute_value).await?
        {
            SpacePanelQuota::repository()
                .with_tx(&tx)
                .delete(existing.id)
                .await
                .map_err(|e| {
                    crate::error!("Failed to delete panel quotas: {e}");
                    SpaceAppError::PanelQuotaDeleteFailed
                })?;
        }
    }
    tx.commit().await.map_err(crate::common::Error::from)?;

    Ok(true)
}
