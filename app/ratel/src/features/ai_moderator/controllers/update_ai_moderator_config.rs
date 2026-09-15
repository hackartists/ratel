use crate::features::ai_moderator::*;

use super::get_ai_moderator_config::AiModeratorConfigResponse;
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct UpdateAiModeratorConfigRequest {
    pub enabled: bool,
    pub reply_interval: i64,
    #[serde(default)]
    pub guidelines: String,
}

#[mcp_tool(name = "update_ai_moderator", description = "Configure AI moderator for a discussion. Sets enabled state, reply interval, and guidelines. Requires creator role and premium membership.")]
#[post("/api/spaces/{space_id}/discussions/{discussion_id}/ai-moderator", role: SpaceUserRole, user: crate::features::auth::User)]
pub async fn update_ai_moderator_config(
    #[mcp(description = "Space partition key")]
    space_id: SpacePartition,
    #[mcp(description = "Discussion sort key (e.g. 'SpacePost#<uuid>')")]
    discussion_id: SpaceDiscussionEntityType,
    #[mcp(description = "AI moderator config: {\"enabled\": bool, \"reply_interval\": int, \"guidelines\": \"text\"}")]
    req: UpdateAiModeratorConfigRequest,
) -> Result<AiModeratorConfigResponse> {
    use postgres::ops::StringOp;

    role.is_creator()?;

    super::require_premium(&user).await?;

    if req.reply_interval < 1 {
        return Err(AiModeratorError::InvalidReplyInterval.into());
    }

    let now = crate::common::utils::time::get_now_timestamp_millis();

    // Preserve the existing row's `id` / `created_at` on update, otherwise
    // build a fresh config. `upsert_on` the `(space_id, discussion_id)`
    // natural key so create and update collapse into one write.
    let existing = AiModeratorConfig::repository()
        .find_one(
            AiModeratorConfig::query()
                .space_id(StringOp::Eq(space_id.to_string()))
                .discussion_id(StringOp::Eq(discussion_id.to_string())),
        )
        .await
        .map_err(crate::common::Error::from)?;

    let mut config =
        existing.unwrap_or_else(|| AiModeratorConfig::new(space_id.clone(), discussion_id.to_string()));
    config.enabled = req.enabled;
    config.reply_interval = req.reply_interval;
    config.guidelines = req.guidelines.clone();
    config.updated_at = now;

    AiModeratorConfig::repository()
        .upsert_on(&["space_id", "discussion_id"], &config)
        .await
        .map_err(crate::common::Error::from)?;

    Ok(AiModeratorConfigResponse {
        enabled: req.enabled,
        reply_interval: req.reply_interval,
        guidelines: req.guidelines,
    })
}
