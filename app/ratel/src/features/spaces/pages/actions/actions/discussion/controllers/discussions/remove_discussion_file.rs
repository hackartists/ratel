use crate::features::spaces::pages::actions::actions::discussion::*;
use crate::features::spaces::pages::apps::apps::file::{
    delete_file_link, DeleteFileLinkRequest, FileLinkTarget,
};

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct RemoveDiscussionFileRequest {
    pub file_url: String,
}

#[delete("/api/spaces/{space_id}/discussions/{discussion_id}/files", role: SpaceUserRole)]
pub async fn remove_discussion_file(
    space_id: SpacePartition,
    discussion_id: SpacePostEntityType,
    req: RemoveDiscussionFileRequest,
) -> Result<()> {
    SpacePost::can_edit(&role)?;
    let link_target = FileLinkTarget::Board(discussion_id.to_string());

    let mut post = SpacePost::get_one(&space_id, &SpacePostPartition(discussion_id.0.clone()))
        .await?
        .ok_or(SpaceActionDiscussionError::NotFound)?;

    let updated_files: Vec<File> = post
        .files
        .iter()
        .filter(|f| f.url.as_ref() != Some(&req.file_url))
        .cloned()
        .collect();

    post.files = PostFiles(updated_files);
    SpacePost::repository()
        .upsert(&post)
        .await
        .map_err(crate::common::Error::from)?;

    delete_file_link(
        space_id,
        DeleteFileLinkRequest {
            file_url: req.file_url,
            link_target,
        },
    )
    .await?;

    Ok(())
}
