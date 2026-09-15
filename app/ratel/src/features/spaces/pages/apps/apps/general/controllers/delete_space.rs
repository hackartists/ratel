use crate::features::spaces::pages::apps::apps::general::*;
#[cfg(feature = "server")]
use crate::common::SpaceUserRole;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct DeleteSpaceResponse {
    pub message: String,
}

#[mcp_tool(name = "delete_space", description = "Delete a space and unlink its post. Requires creator role.")]
#[delete("/api/spaces/{space_id}/settings", role: SpaceUserRole)]
pub async fn delete_space(
    #[mcp(description = "Space partition key")]
    space_id: SpacePartition,
) -> crate::common::Result<DeleteSpaceResponse> {
    use crate::common::models::space::SpaceCommon;
    use crate::common::types::Partition;
    use crate::features::posts::models::Post;
    use crate::features::spaces::pages::actions::actions::poll::SpacePoll;
    use postgres::PostgresEntity;

    if role != SpaceUserRole::Creator {
        return Err(Error::NoPermission);
    }

    let space_pk: Partition = space_id.clone().into();
    let space = SpaceCommon::get_by_partition(&space_pk)
        .await?
        .ok_or(Error::SpaceNotFound)?;

    let post_pk = space_pk.clone().to_post_key()?;

    SpaceCommon::repository()
        .delete(space.id)
        .await
        .map_err(crate::common::Error::from)?;
    SpacePoll::delete_one(&space_pk).await?;
    // TODO(main-api only): delete SpaceDiscussion entities linked to this space.
    // TODO(main-api only): delete SpaceFile entities linked to this space.
    // TODO(main-api only): delete SpaceRecommendation entities linked to this space.

    let post_id = match &post_pk {
        Partition::Feed(id) => uuid::Uuid::parse_str(id).ok(),
        _ => None,
    };

    if let Some(post_id) = post_id {
        if let Some(post) = Post::get_by_feed_id(post_id).await? {
            Post::repository()
                .update(
                    post.id,
                    Post::update()
                        .space_pk(None)
                        .space_type(None)
                        .space_visibility(None),
                )
                .await
                .map_err(crate::common::Error::from)?;
        }
    }

    Ok(DeleteSpaceResponse {
        message: format!("Space '{}' deleted", space_id),
    })
}
