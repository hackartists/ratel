use crate::features::spaces::pages::apps::apps::file::types::FileLinkTarget;
use crate::features::spaces::pages::apps::apps::file::*;
#[cfg(feature = "server")]
use crate::common::SpaceUserRole;
#[cfg(feature = "server")]
use crate::features::spaces::pages::apps::apps::file::models::{FileLink, SpaceFile};

#[get("/api/spaces/{space_pk}/overview-files", _role: SpaceUserRole)]
pub async fn get_overview_files(space_pk: SpacePartition) -> Result<Vec<File>> {
    let space_pk: Partition = space_pk.into();

    let space_file = SpaceFile::get_by_space(&space_pk).await?.unwrap_or_default();

    let links = FileLink::list_by_space(&space_pk).await?;

    let overview_urls: std::collections::HashSet<String> = links
        .into_iter()
        .filter(|l| l.link_target == FileLinkTarget::Overview)
        .map(|l| l.file_url)
        .collect();

    let overview_files = space_file
        .files
        .0
        .into_iter()
        .filter(|f| f.url.as_ref().is_some_and(|url| overview_urls.contains(url)))
        .collect();

    Ok(overview_files)
}
