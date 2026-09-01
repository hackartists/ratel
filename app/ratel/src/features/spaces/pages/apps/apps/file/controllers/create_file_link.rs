use crate::features::spaces::pages::apps::apps::file::*;
#[cfg(feature = "server")]
use crate::features::spaces::pages::apps::apps::file::models::{FileLink, SpaceFile};
#[cfg(feature = "server")]
use crate::common::SpaceUserRole;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct CreateFileLinkRequest {
    pub file_url: String,
    pub file_name: Option<String>,
    pub link_target: FileLinkTarget,
}

#[post("/api/spaces/{space_pk}/file-links", _role: SpaceUserRole)]
pub async fn create_file_link(
    space_pk: SpacePartition,
    req: CreateFileLinkRequest,
) -> Result<()> {
    let space_pk: Partition = space_pk.into();
    let now = crate::common::utils::time::now();

    let file_link = FileLink::new(space_pk.clone(), req.file_url.clone(), req.link_target, now);

    FileLink::repository().insert(&file_link).await?;

    let name = req
        .file_name
        .filter(|n| !n.trim().is_empty())
        .unwrap_or_else(|| extract_filename_from_url(&req.file_url));
    let ext = FileExtension::from_name_or_url(&name, &req.file_url);
    let new_file = File {
        id: crate::common::uuid::Uuid::now_v7().to_string(),
        name,
        ext,
        url: Some(req.file_url),
        ..Default::default()
    };

    let existing = SpaceFile::get_by_space(&space_pk).await?;
    if let Some(mut space_file) = existing {
        space_file.files.0.push(new_file);
        space_file.save().await?;
    } else {
        SpaceFile::new(space_pk, vec![new_file]).save().await?;
    }

    Ok(())
}
