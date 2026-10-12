use crate::features::spaces::pages::apps::models::SpaceApp;
use crate::features::spaces::pages::apps::*;
use crate::common::SpaceUserRole;
use crate::common::models::space::SpaceCommon;
use crate::common::types::Partition;
use crate::common::types::SpacePartition;

#[mcp_tool(name = "install_space_app", description = "Install an app in a space. Requires creator role. Types: General, File, Analyzes, Panels, Sampling (Sampling only while the space is Designing or Open).")]
#[post("/api/spaces/{space_id}/apps", role: SpaceUserRole, space: SpaceCommon)]
pub async fn install_space_app(
    #[mcp(description = "Space partition key")]
    space_id: SpacePartition,
    #[mcp(description = "App type: 'General', 'File', 'Analyzes', 'Panels', or 'Sampling'")]
    app_type: SpaceAppType,
) -> Result<SpaceApp> {
    use crate::features::spaces::pages::apps::apps::sampling::SpaceSamplingError;
    use postgres::PostgresEntity;

    SpaceApp::can_edit(role)?;

    let space_pk_partition: Partition = space_id.clone().into();

    let app = SpaceApp::new(space_pk_partition, app_type);

    if app_type != SpaceAppType::Sampling {
        return SpaceApp::repository().insert(&app).await.map_err(|e| {
            crate::error!("Failed to install app: {e}");
            SpaceAppError::InstallFailed.into()
        });
    }

    if !matches!(space.status, None | Some(SpaceStatus::Designing | SpaceStatus::Open)) {
        return Err(SpaceSamplingError::ConfigLocked.into());
    }
    let install = async {
        let tx = postgres::Tx::begin().await?;
        let app = SpaceApp::repository().with_tx(&tx).insert(&app).await?;
        SpaceCommon::repository()
            .with_tx(&tx)
            .update(space.id, SpaceCommon::update().sampling_enabled(true))
            .await?;
        tx.commit().await?;
        Ok::<_, crate::common::Error>(app)
    };
    install.await.map_err(|e| {
        crate::error!("Failed to install sampling app: {e}");
        SpaceAppError::InstallFailed.into()
    })
}
