use crate::features::posts::models::Post;
use crate::features::posts::types::{PostError, TeamGroupPermission};
use crate::features::posts::*;
use crate::common::models::space::{SpaceCommon, SpaceParticipant};
use crate::common::types::SpacePartition;
use crate::features::auth::User;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;
#[cfg(feature = "server")]
use postgres::PostgresEntity;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct CreateSpaceRequest {
    pub post_id: FeedPartition,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct CreateSpaceResponse {
    pub space_id: SpacePartition,
}

#[mcp_tool(name = "create_space", description = "Create a space on an existing post.")]
#[post("/api/spaces/create", user: User)]
pub async fn create_space_handler(req: CreateSpaceRequest) -> Result<CreateSpaceResponse> {
    let conf = crate::features::posts::config::get();
    let cli = conf.dynamodb();

    let post_uuid = uuid::Uuid::parse_str(&req.post_id.0)
        .map_err(|_| Error::NotFound("Post not found".into()))?;
    let (mut post, has_perm) =
        Post::has_permission(cli, post_uuid, Some(&user.pk()), TeamGroupPermission::PostEdit).await?;
    if !has_perm {
        return Err(PostError::NotAccessible.into());
    }

    let space = SpaceCommon::new(
        req.post_id.clone(),
        post.author_partition(),
        post.author_display_name.clone(),
        post.author_profile_url.clone(),
        post.author_username.clone(),
    );
    let participant = SpaceParticipant::new_non_anonymous(space.partition(), user.clone());

    // Space + participant now both live in Postgres — write them inside one
    // transaction, restoring the atomicity the DynamoDB transact-write item
    // pair used to provide. The Post's `space_pk` update is committed
    // separately afterward (mirrors the original two-step: transact write
    // followed by a plain Post save).
    let tx = postgres::Tx::begin()
        .await
        .map_err(crate::common::Error::from)?;
    SpaceCommon::repository()
        .with_tx(&tx)
        .insert(&space)
        .await
        .map_err(crate::common::Error::from)?;
    SpaceParticipant::repository()
        .with_tx(&tx)
        .insert(&participant)
        .await
        .map_err(crate::common::Error::from)?;
    tx.commit().await.map_err(crate::common::Error::from)?;

    post.space_pk = Some(space.space_pk.clone());
    post.save().await?;

    let space_id = match space.partition() {
        Partition::Space(id) => SpacePartition(id),
        _ => SpacePartition::default(),
    };

    Ok(CreateSpaceResponse { space_id })
}
