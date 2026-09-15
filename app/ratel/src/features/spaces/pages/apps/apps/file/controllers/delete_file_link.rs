use crate::features::spaces::pages::apps::apps::file::*;
#[cfg(feature = "server")]
use crate::features::spaces::pages::apps::apps::file::models::{FileLink, SpaceFile};
#[cfg(feature = "server")]
use crate::common::SpaceUserRole;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct DeleteFileLinkRequest {
    pub file_url: String,
    pub link_target: FileLinkTarget,
}

#[delete("/api/spaces/{space_pk}/file-links", _role: SpaceUserRole)]
pub async fn delete_file_link(
    space_pk: SpacePartition,
    req: DeleteFileLinkRequest,
) -> Result<()> {
    let space_pk: Partition = space_pk.into();

    let links = FileLink::list_by_space(&space_pk).await?;

    for link in &links {
        if link.file_url == req.file_url && link.link_target == req.link_target {
            FileLink::repository().delete(link.id).await?;
            break;
        }
    }

    let remaining = links
        .iter()
        .filter(|l| l.file_url == req.file_url && l.link_target != req.link_target)
        .count();

    if remaining == 0 {
        if let Some(mut space_file) = SpaceFile::get_by_space(&space_pk).await? {
            space_file
                .files
                .0
                .retain(|f| f.url.as_deref() != Some(&req.file_url));
            space_file.save().await?;
        }
    }

    Ok(())
}
