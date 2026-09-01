use by_macros::QdrantEntity;
use serde::Serialize;

use crate::common::types::{Partition, SpacePartition, UserOrTeam};
use crate::features::rag::qdrant::types::QdrantIndexType;
use crate::types::*;

/// Payload for indexing a discussion reply into Qdrant.
#[derive(Debug, Clone, Serialize, QdrantEntity)]
#[qdrant(collection_name = "main")]
pub struct ReplyPayload {
    // Mandatory fields
    pub r#type: QdrantIndexType,
    pub tenant_id: String,
    pub user_id: UserOrTeam,
    pub space_id: SpacePartition,
    // Reply-specific fields
    #[qdrant(id)]
    pub comment_id: SpacePostCommentEntityType,
    pub discussion_id: SpacePostPartition,
    pub content: String,
    pub author: String,
}

#[cfg(feature = "server")]
#[async_trait::async_trait]
impl crate::features::rag::qdrant::types::Embedding for ReplyPayload {
    async fn embed(&self) -> crate::common::Result<Vec<f32>> {
        let config = crate::common::CommonConfig::default();
        let bedrock = config.bedrock_embeddings();
        bedrock.embed(&self.content).await
    }
}

impl ReplyPayload {
    pub fn from_comment(
        comment: &crate::features::spaces::pages::actions::actions::discussion::SpacePostComment,
        tenant_id: String,
    ) -> Self {
        let space_id = SpacePartition(comment.space_id.clone().unwrap_or_default());
        let author_pk = comment
            .author_pk
            .parse::<Partition>()
            .unwrap_or_else(|_| Partition::User(comment.author_pk.clone()));
        // Replies build `{parent_id}#{reply_id}` — mirrors
        // `activity::services::handle_xp_event::handle_discussion_xp`, which
        // reconstructs the same legacy `SpacePostCommentReply` sk shape.
        let comment_id = if comment.parent_comment_id.is_empty() {
            SpacePostCommentEntityType(comment.comment_id.clone())
        } else {
            SpacePostCommentEntityType(format!(
                "{}#{}",
                comment.parent_comment_id, comment.comment_id
            ))
        };

        Self {
            r#type: QdrantIndexType::Reply,
            tenant_id,
            user_id: UserOrTeam::from(author_pk),
            space_id,
            comment_id,
            discussion_id: SpacePostPartition(comment.post_id.clone()),
            content: comment.content.clone(),
            author: comment.author_display_name.clone(),
        }
    }
}
