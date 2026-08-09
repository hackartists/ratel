use crate::features::spaces::pages::apps::models::SpaceApp;
use crate::features::spaces::pages::apps::*;
use crate::common::SpaceUserRole;
use crate::common::types::Partition;
use crate::common::types::SpacePartition;

#[mcp_tool(name = "uninstall_space_app", description = "Uninstall an app from a space. Requires creator role.")]
#[delete("/api/spaces/{space_id}/apps", role: SpaceUserRole)]
pub async fn uninstall_space_app(
    #[mcp(description = "Space partition key")]
    space_id: SpacePartition,
    #[mcp(description = "App type: 'General', 'File', 'Analyzes', or 'Panels'")]
    app_type: SpaceAppType,
) -> Result<SpaceApp> {
    SpaceApp::can_delete(role)?;

    let space_pk_partition: Partition = space_id.clone().into();

    let app = SpaceApp::new(space_pk_partition.clone(), app_type);

    if let Some(existing) = SpaceApp::find_by_space_and_type(&space_pk_partition, app_type).await? {
        SpaceApp::repository()
            .delete(existing.id)
            .await
            .map_err(|e| {
                crate::error!("Failed to uninstall app: {e}");
                SpaceAppError::UninstallFailed
            })?;
    }

    Ok(app)
}
