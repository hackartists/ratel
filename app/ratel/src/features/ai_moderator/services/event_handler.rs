use crate::common::Result;
use crate::features::ai_moderator::types::AiModeratorError;
use crate::common::types::*;
use crate::features::ai_moderator::models::*;
use crate::features::ai_moderator::services::moderation_handler;
// SpacePost and SpacePostComment are publicly re-exported from the discussion module
use crate::features::spaces::pages::actions::actions::discussion::SpacePost;
use crate::features::spaces::pages::actions::actions::discussion::SpacePostComment;

const AI_MODERATOR_DISPLAY_NAME: &str = "AI Moderator";
const AI_MODERATOR_USERNAME: &str = "ai-moderator";
const MAX_RECENT_REPLIES: usize = 20;

/// Handle a SpacePost stream event: check if AI moderation should trigger.
///
/// Called from EventBridge when a SpacePost's `comments` field changes.
/// The `post` is deserialized from the DynamoDB NewImage.
pub async fn handle_ai_moderator_event(post: SpacePost) -> Result<()> {
    let common_config = crate::common::CommonConfig::default();

    let space_id = SpacePartition(post.space_id.clone());
    let discussion_id = post.post_id.clone();

    // Check if AI moderation should trigger for this reply count
    let config =
        match moderation_handler::should_moderate(&space_id, &discussion_id, post.comments)
            .await?
        {
            Some(config) => config,
            None => return Ok(()), // No moderation needed
        };

    tracing::info!(
        space_id = %post.space_id,
        discussion_id = %discussion_id,
        comments = post.comments,
        reply_interval = config.reply_interval,
        "AI Moderator triggered"
    );

    // Fetch recent replies for context (top-level comments only, newest
    // first — mirrors the old sk-prefix-scoped, limited DynamoDB query).
    let space_post_pk = SpacePostPartition(discussion_id.clone());
    let (comments, _) =
        SpacePostComment::list_top_level(&discussion_id, None, MAX_RECENT_REPLIES as i64).await?;

    let recent_replies: Vec<String> = comments
        .iter()
        .map(|c| format!("[{}]: {}", c.author_display_name, c.content))
        .collect();

    // Fetch material context from Qdrant (best-effort)
    let material_context =
        fetch_material_context(&common_config, &post.space_id, &discussion_id, &recent_replies)
            .await;

    // Generate AI moderation reply
    let reply_text =
        moderation_handler::generate_moderation_reply(&config, recent_replies, material_context)
            .await?;

    // Save the AI moderator reply as a SpacePostComment
    let ai_author = crate::common::models::space::SpaceUser {
        pk: Partition::default(),
        display_name: AI_MODERATOR_DISPLAY_NAME.to_string(),
        username: AI_MODERATOR_USERNAME.to_string(),
        profile_url: String::new(),
    };

    let comment: SpacePostComment =
        SpacePost::comment(space_id, space_post_pk, reply_text, vec![], &ai_author)
            .await
            .map_err(|e| {
                crate::error!("Failed to save AI moderator reply: {e}");
                AiModeratorError::ReplySaveFailed
            })?;

    tracing::info!(
        comment_id = %comment.comment_id,
        "AI Moderator reply saved"
    );

    Ok(())
}

/// Fetch relevant material context from Qdrant (best-effort, errors are logged and ignored).
async fn fetch_material_context(
    config: &crate::common::CommonConfig,
    _space_id: &str,
    _discussion_sk: &str,
    recent_replies: &[String],
) -> Vec<String> {
    let query_text = recent_replies
        .iter()
        .take(5)
        .cloned()
        .collect::<Vec<_>>()
        .join(" ");

    if query_text.is_empty() {
        return Vec::new();
    }

    let bedrock = config.bedrock_embeddings();
    let _embedding = match bedrock.embed(&query_text).await {
        Ok(v) => v,
        Err(e) => {
            tracing::warn!(error = %e, "Failed to embed query for material search");
            return Vec::new();
        }
    };

    let _qdrant = config.qdrant();
    // TODO: Implement Qdrant search for material retrieval using the official client.
    // Use MaterialPayload::collection_name() and filter by type=material, space_id, discussion_id.
    // Use _qdrant.search_points(...) with _embedding vector.

    Vec::new()
}
