use crate::features::spaces::pages::apps::models::SpaceApp;
use crate::features::spaces::pages::apps::*;
use crate::common::SpaceUserRole;
use crate::common::models::space::SpaceCommon;
use crate::common::types::Partition;
use crate::common::types::SpacePartition;

#[mcp_tool(name = "uninstall_space_app", description = "Uninstall an app from a space. Requires creator role. Sampling can only be removed while the space is Designing or Open.")]
#[delete("/api/spaces/{space_id}/apps", role: SpaceUserRole, space: SpaceCommon)]
pub async fn uninstall_space_app(
    #[mcp(description = "Space partition key")]
    space_id: SpacePartition,
    #[mcp(description = "App type: 'General', 'File', 'Analyzes', 'Panels', or 'Sampling'")]
    app_type: SpaceAppType,
) -> Result<SpaceApp> {
    use crate::features::spaces::pages::apps::apps::sampling::services::sampling_space_id;
    use crate::features::spaces::pages::apps::apps::sampling::{
        SpaceSamplingCell, SpaceSamplingConfig, SpaceSamplingEntryKey, SpaceSamplingError,
        SpaceSamplingMember,
    };
    use postgres::PostgresEntity;

    SpaceApp::can_delete(role)?;

    let space_pk_partition: Partition = space_id.clone().into();

    let app = SpaceApp::new(space_pk_partition.clone(), app_type);

    let existing = SpaceApp::find_by_space_and_type(&space_pk_partition, app_type).await?;

    if app_type != SpaceAppType::Sampling {
        if let Some(existing) = existing {
            SpaceApp::repository()
                .delete(existing.id)
                .await
                .map_err(|e| {
                    crate::error!("Failed to uninstall app: {e}");
                    SpaceAppError::UninstallFailed
                })?;
        }
        return Ok(app);
    }

    if !matches!(space.status, None | Some(SpaceStatus::Designing | SpaceStatus::Open)) {
        return Err(SpaceSamplingError::ConfigLocked.into());
    }
    let sid = sampling_space_id(&space);
    let uninstall = async {
        let tx = postgres::Tx::begin().await?;
        if let Some(existing) = existing {
            SpaceApp::repository().with_tx(&tx).delete(existing.id).await?;
        }
        SpaceSamplingEntryKey::delete_by_space_tx(&tx, &sid).await?;
        SpaceSamplingMember::delete_by_space_tx(&tx, &sid).await?;
        SpaceSamplingCell::delete_by_space_tx(&tx, &sid).await?;
        SpaceSamplingConfig::delete_by_space_tx(&tx, &sid).await?;
        SpaceCommon::repository()
            .with_tx(&tx)
            .update(
                space.id,
                SpaceCommon::update().sampling_enabled(false).sampling_recruit_open(false),
            )
            .await?;
        tx.commit().await?;
        Ok::<_, crate::common::Error>(())
    };
    uninstall.await.map_err(|e| {
        crate::error!("Failed to uninstall sampling app: {e}");
        SpaceAppError::UninstallFailed
    })?;

    Ok(app)
}
