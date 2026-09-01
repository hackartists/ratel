use crate::features::posts::models::*;
use crate::features::posts::types::*;
use crate::features::posts::*;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub struct PostCommentResponse {
    pub pk: FeedPartition,
    pub sk: PostCommentTargetEntityType,

    pub updated_at: i64,

    pub content: String,

    #[serde(default)]
    pub images: Vec<String>,

    pub likes: u64,
    pub reports: i64,
    pub replies: u64,

    pub parent_comment_sk: Option<PostCommentTargetEntityType>,

    pub author_pk: Partition,
    pub author_display_name: String,
    pub author_username: String,
    pub author_profile_url: String,

    pub liked: bool,
    pub is_report: bool,
}

/// The comment's own wire `sk` — `<parent>::<id>` for a reply, or `<id>` for a
/// top-level comment (mirrors `PostCommentTargetEntityType`'s reply encoding).
fn comment_sk(comment: &PostComment) -> PostCommentTargetEntityType {
    match comment.parent_comment_id {
        Some(parent) => PostCommentTargetEntityType(format!("{parent}::{}", comment.id)),
        None => PostCommentTargetEntityType(comment.id.to_string()),
    }
}

impl From<(PostComment, bool, bool)> for PostCommentResponse {
    fn from((comment, liked, is_report): (PostComment, bool, bool)) -> Self {
        Self {
            pk: Partition::Feed(comment.post_id.to_string()).into(),
            sk: comment_sk(&comment),
            updated_at: comment.updated_at,
            content: comment.content.clone(),
            images: comment.images.0.clone(),
            likes: comment.likes as u64,
            reports: comment.reports,
            replies: comment.replies as u64,
            parent_comment_sk: comment
                .parent_comment_id
                .map(|p| PostCommentTargetEntityType(p.to_string())),
            author_pk: comment.author_pk.parse::<Partition>().unwrap_or_default(),
            author_display_name: comment.author_display_name,
            author_username: comment.author_username,
            author_profile_url: comment.author_profile_url,
            liked,
            is_report,
        }
    }
}

impl From<PostComment> for PostCommentResponse {
    fn from(comment: PostComment) -> Self {
        Self::from((comment, false, false))
    }
}
