use crate::common::SpaceUserRole;
use crate::common::types::Partition;
use crate::common::types::SpacePartition;
use crate::features::spaces::pages::apps::models::SpaceApp;
use crate::features::spaces::pages::apps::*;

#[get("/api/spaces/{space_id}/apps", role: SpaceUserRole)]
pub async fn get_space_apps(space_id: SpacePartition) -> Result<Vec<SpaceApp>> {
    SpaceApp::can_view(role)?;

    let space_pk: Partition = space_id.clone().into();

    let apps = SpaceApp::list_by_space(&space_pk).await?;

    Ok(apps)
}
