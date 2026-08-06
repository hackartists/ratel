use crate::features::spaces::pages::actions::actions::discussion::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct DiscussionCommentResponse {
    pub pk: Partition,
    pub sk: EntityType,

    pub updated_at: i64,
    pub created_at: i64,

    pub content: String,
    #[serde(default)]
    pub images: Vec<String>,

    pub likes: u64,
    pub replies: u64,

    pub parent_comment_sk: Option<EntityType>,

    pub author_pk: Partition,
    pub author_display_name: String,
    pub author_username: String,
    pub author_profile_url: String,

    pub liked: bool,
}

#[cfg(feature = "server")]
impl From<(SpacePostComment, bool)> for DiscussionCommentResponse {
    fn from((comment, liked): (SpacePostComment, bool)) -> Self {
        let pk = comment.post_partition();
        let sk = comment.comment_entity();
        let parent_comment_sk = comment.parent_comment_entity();
        let author_pk = comment.author_partition();
        Self {
            pk,
            sk,
            created_at: comment.created_at,
            updated_at: comment.updated_at,
            content: comment.content,
            images: comment.images.0,
            likes: comment.likes as u64,
            replies: comment.replies as u64,
            parent_comment_sk,
            author_pk,
            author_display_name: comment.author_display_name,
            author_username: comment.author_username,
            author_profile_url: comment.author_profile_url,
            liked,
        }
    }
}

#[cfg(feature = "server")]
impl From<SpacePostComment> for DiscussionCommentResponse {
    fn from(comment: SpacePostComment) -> Self {
        let pk = comment.post_partition();
        let sk = comment.comment_entity();
        let parent_comment_sk = comment.parent_comment_entity();
        let author_pk = comment.author_partition();
        Self {
            pk,
            sk,
            created_at: comment.created_at,
            updated_at: comment.updated_at,
            content: comment.content,
            images: comment.images.0,
            likes: comment.likes as u64,
            replies: comment.replies as u64,
            parent_comment_sk,
            author_pk,
            author_display_name: comment.author_display_name,
            author_username: comment.author_username,
            author_profile_url: comment.author_profile_url,
            liked: false,
        }
    }
}
