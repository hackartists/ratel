use crate::features::posts::*;

#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
use uuid::Uuid;

/// A user's like on a comment (or comment reply).
///
/// Postgres migration: the DynamoDB identity `(pk = PostLike(feed_id),
/// sk = PostCommentLike(user_id, comment_id))` collapses to a surrogate `id`
/// PK plus the natural key `unique(comment_id, user_pk)`. `post_id` is kept as
/// a plain reference column so a post's whole comment-like set can be swept in
/// one query. All ids are cross-feature/intra-feature references stored as
/// plain columns (no `references=` FK yet).
#[cfg(feature = "server")]
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, PostgresEntity)]
#[postgres(table = "post_comment_likes", unique(comment_id, user_pk))]
pub struct PostCommentLike {
    pub id: Uuid,

    #[postgres(index)]
    pub post_id: Uuid,

    #[postgres(index)]
    pub comment_id: Uuid,

    #[postgres(index)]
    pub user_pk: String,

    #[postgres(order)]
    pub created_at: i64,
}

#[cfg(feature = "server")]
impl PostCommentLike {
    pub fn new(post_id: Uuid, comment_id: Uuid, user_pk: String) -> Self {
        Self {
            id: Uuid::now_v7(),
            post_id,
            comment_id,
            user_pk,
            created_at: chrono::Utc::now().timestamp(),
        }
    }

    /// The single like row for `(comment, user)`, if any.
    pub async fn find_one(comment_id: Uuid, user_pk: &Partition) -> Result<Option<Self>> {
        use postgres::ops::{StringOp, UuidOp};
        Self::repository()
            .find_one(
                Self::query()
                    .comment_id(UuidOp::Eq(comment_id))
                    .user_pk(StringOp::Eq(user_pk.to_string())),
            )
            .await
            .map_err(crate::common::Error::from)
    }

    /// Insert a comment-like row (idempotent on `(comment_id, user_pk)`).
    pub async fn add(post_id: Uuid, comment_id: Uuid, user_pk: String) -> Result<()> {
        let row = Self::new(post_id, comment_id, user_pk);
        Self::repository()
            .upsert_on(&["comment_id", "user_pk"], &row)
            .await
            .map_err(crate::common::Error::from)?;
        Ok(())
    }

    /// Delete the comment-like row for `(comment, user)`, if present.
    pub async fn remove(comment_id: Uuid, user_pk: &Partition) -> Result<()> {
        if let Some(row) = Self::find_one(comment_id, user_pk).await? {
            Self::repository()
                .delete(row.id)
                .await
                .map_err(crate::common::Error::from)?;
        }
        Ok(())
    }

    /// Which of `comment_ids` the given user has liked. Replaces the DynamoDB
    /// `batch_get` of per-comment like keys.
    pub async fn liked_comment_ids(
        user_pk: &Partition,
        comment_ids: Vec<Uuid>,
    ) -> Result<std::collections::HashSet<Uuid>> {
        use postgres::ops::{StringOp, UuidOp};
        if comment_ids.is_empty() {
            return Ok(Default::default());
        }
        let page = Self::repository()
            .find(
                Self::query()
                    .user_pk(StringOp::Eq(user_pk.to_string()))
                    .comment_id(UuidOp::In(comment_ids)),
            )
            .await
            .map_err(crate::common::Error::from)?;
        Ok(page.items.into_iter().map(|l| l.comment_id).collect())
    }
}
