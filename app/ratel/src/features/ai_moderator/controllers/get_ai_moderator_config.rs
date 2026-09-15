use crate::features::ai_moderator::*;
#[cfg(feature = "server")]
use postgres::PostgresEntity;

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct AiModeratorConfigResponse {
    pub enabled: bool,
    pub reply_interval: i64,
    pub guidelines: String,
}

#[get("/api/spaces/{space_id}/discussions/{discussion_id}/ai-moderator", _role: SpaceUserRole)]
pub async fn get_ai_moderator_config(
    space_id: SpacePartition,
    discussion_id: SpaceDiscussionEntityType,
) -> Result<AiModeratorConfigResponse> {
    use postgres::ops::StringOp;

    let config = AiModeratorConfig::repository()
        .find_one(
            AiModeratorConfig::query()
                .space_id(StringOp::Eq(space_id.to_string()))
                .discussion_id(StringOp::Eq(discussion_id.to_string())),
        )
        .await
        .map_err(crate::common::Error::from)?;

    match config {
        Some(config) => Ok(AiModeratorConfigResponse {
            enabled: config.enabled,
            reply_interval: config.reply_interval,
            guidelines: config.guidelines,
        }),
        None => Ok(AiModeratorConfigResponse::default()),
    }
}
