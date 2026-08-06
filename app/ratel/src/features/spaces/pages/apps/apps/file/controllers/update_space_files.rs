use crate::features::spaces::pages::apps::apps::file::*;
#[cfg(feature = "server")]
use crate::features::spaces::pages::apps::apps::file::models::{SpaceFile, SpaceFileList};
#[cfg(feature = "server")]
use crate::common::SpaceUserRole;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct UpdateSpaceFilesRequest {
    pub files: Vec<File>,
}

#[patch("/api/spaces/{space_pk}/files", role: SpaceUserRole)]
pub async fn update_space_files(
    space_pk: SpacePartition,
    req: UpdateSpaceFilesRequest,
) -> Result<Vec<File>> {
    if role != SpaceUserRole::Creator {
        return Err(Error::NoPermission);
    }

    let space_pk: Partition = space_pk.into();

    // Ensure all files have IDs
    let mut files_with_ids = req.files;
    for file in &mut files_with_ids {
        if file.id.is_empty() {
            file.id = crate::common::uuid::Uuid::now_v7().to_string();
        }
    }

    if let Some(mut existing) = SpaceFile::get_by_space(&space_pk).await? {
        existing.files = SpaceFileList(files_with_ids.clone());
        existing.save().await?;
    } else {
        SpaceFile::new(space_pk, files_with_ids.clone()).save().await?;
    }

    Ok(files_with_ids)
}
