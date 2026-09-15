use crate::features::spaces::pages::apps::apps::file::*;
#[cfg(feature = "server")]
use crate::features::spaces::pages::apps::apps::file::models::SpaceFile;
#[cfg(feature = "server")]
use crate::common::SpaceUserRole;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct DeleteSpaceFileRequest {
    pub file_url: String,
}

#[delete("/api/spaces/{space_pk}/files", role: SpaceUserRole)]
pub async fn delete_space_file(
    space_pk: SpacePartition,
    req: DeleteSpaceFileRequest,
) -> Result<bool> {
    if role != SpaceUserRole::Creator {
        return Err(Error::NoPermission);
    }

    let space_pk: Partition = space_pk.into();

    if let Some(mut space_file) = SpaceFile::get_by_space(&space_pk).await? {
        space_file
            .files
            .0
            .retain(|f| f.url.as_ref() != Some(&req.file_url));
        space_file.save().await?;
    }

    Ok(true)
}
