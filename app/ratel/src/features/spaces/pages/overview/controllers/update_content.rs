use crate::features::spaces::pages::overview::*;
use crate::features::spaces::types::SpaceError;
#[cfg(feature = "server")]
use crate::common::models::space::SpaceCommon;
#[cfg(feature = "server")]
use crate::common::SpaceUserRole;
#[cfg(feature = "server")]
use crate::features::posts::models::Post;
#[cfg(feature = "server")]
use postgres::PostgresEntity;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateContentRequest {
    pub content: String,
}

#[patch("/api/spaces/{space_pk}/overview/content", role: SpaceUserRole)]
pub async fn update_space_content(
    space_pk: SpacePartition,
    req: UpdateContentRequest,
) -> Result<()> {
    if role != SpaceUserRole::Creator {
        return Err(Error::NoPermission);
    }

    let space_partition = Partition::Space(space_pk.to_string());
    let post_partition = space_partition.clone().to_post_key()?;

    let space = SpaceCommon::get_by_partition(&space_partition)
        .await
        .map_err(|e| {
            crate::error!("failed to load space for content update: {e:?}");
            SpaceError::UpdateFailed
        })?
        .ok_or(SpaceError::UpdateFailed)?;
    let post_uuid = match &post_partition {
        Partition::Feed(id) => uuid::Uuid::parse_str(id).map_err(|e| {
            crate::error!("invalid post id for content update: {e:?}");
            SpaceError::UpdateFailed
        })?,
        _ => return Err(SpaceError::UpdateFailed.into()),
    };

    // Sequential, NOT `tokio::try_join!`: racing two pooled-connection writes
    // means a cancellation can drop one mid-`.await`, wedging its sqlx
    // connection on the untimed release-ping and permanently leaking the pool
    // permit (see character/get_character). Two independent updates give the
    // same result run in sequence.
    SpaceCommon::repository()
        .update(space.id, SpaceCommon::update().content(req.content.clone()))
        .await
        .map_err(|e| {
            crate::error!("failed to update space content: {e:?}");
            SpaceError::UpdateFailed
        })?;
    Post::repository()
        .update(post_uuid, Post::update().body(ContentBody::html(req.content)))
        .await
        .map_err(|e| {
            crate::error!("failed to update post content: {e:?}");
            SpaceError::UpdateFailed
        })?;

    Ok(())
}
