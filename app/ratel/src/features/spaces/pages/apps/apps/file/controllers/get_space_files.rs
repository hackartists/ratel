use crate::features::spaces::pages::apps::apps::file::*;
#[cfg(feature = "server")]
use crate::common::SpaceUserRole;
#[cfg(feature = "server")]
use crate::features::spaces::pages::apps::apps::file::models::SpaceFile;

#[get("/api/spaces/{space_pk}/files", _role: SpaceUserRole)]
pub async fn get_space_files(space_pk: SpacePartition) -> Result<Vec<File>> {
    let space_pk: Partition = space_pk.into();

    let mut space_file = SpaceFile::get_by_space(&space_pk)
        .await?
        .unwrap_or_else(|| SpaceFile::new(space_pk.clone(), Vec::new()));

    // Lazy migration: auto-generate IDs for files that don't have them
    let mut needs_update = false;
    for file in space_file.files.iter_mut() {
        if file.id.is_empty() {
            file.id = crate::common::uuid::Uuid::now_v7().to_string();
            needs_update = true;
        }
    }

    if needs_update {
        space_file.save().await?;
    }

    Ok(space_file.files.0)
}
