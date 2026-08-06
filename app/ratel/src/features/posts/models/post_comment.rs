use super::pg_json::StringVec;
use crate::features::auth::User;
use crate::features::posts::types::*;
use crate::features::posts::*;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

use uuid::Uuid;

#[cfg(feature = "server")]
use postgres::PostgresEntity;

use super::Post;

/// A comment (or reply) on a post.
///
/// Postgres migration: the DynamoDB identity `(pk = Feed/PostReply(feed_id),
/// sk = PostComment(uuid) | PostCommentReply(parent, uuid))` collapses to a
/// surrogate `id` PK (the comment's own UUID) plus:
/// - `post_id`: the feed post's UUID (indexed).
/// - `parent_comment_id`: `Some(uuid)` for a reply, `None` for a top-level
///   comment — replaces the `PostReply` partition + `PostCommentReply` sk hack.
///
/// Stays cross-platform (returned directly by the comment handlers and embedded
/// in `PostMetadata`); only the `PostgresEntity` derive + model `impl` are
/// server-gated. `author_pk` holds the full `Partition` string (wire-identical
/// to the old `Partition` field). `images` is JSONB via `StringVec`.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "server", derive(postgres::PostgresEntity))]
#[cfg_attr(feature = "server", postgres(table = "post_comments"))]
pub struct PostComment {
    pub id: Uuid,

    #[cfg_attr(feature = "server", postgres(index))]
    pub post_id: Uuid,

    #[serde(default)]
    #[cfg_attr(feature = "server", postgres(index))]
    pub parent_comment_id: Option<Uuid>,

    #[cfg_attr(feature = "server", postgres(order))]
    pub created_at: i64,
    pub updated_at: i64,

    pub content: String,

    #[serde(default)]
    pub images: StringVec,

    #[serde(default)]
    pub likes: i64,
    #[serde(default)]
    pub reports: i64,
    #[serde(default)]
    pub replies: i64,

    pub author_pk: String,
    pub author_display_name: String,
    pub author_username: String,
    pub author_profile_url: String,
}

#[cfg(feature = "server")]
impl PostComment {
    pub fn new(post_id: Uuid, content: String, images: Vec<String>, user: User) -> Self {
        let now = chrono::Utc::now().timestamp();

        let author_pk = user.pk();
        let User {
            display_name: author_display_name,
            username: author_username,
            profile_url: author_profile_url,
            ..
        } = user;

        Self {
            id: Uuid::now_v7(),
            post_id,
            parent_comment_id: None,
            created_at: now,
            updated_at: now,
            content,
            images: StringVec(images),
            author_pk: author_pk.to_string(),
            author_display_name,
            author_username,
            author_profile_url,
            likes: 0,
            reports: 0,
            replies: 0,
        }
    }

    /// Top-level comments on a post (no parent), newest first.
    pub async fn list_top_level(
        post_id: Uuid,
        page: i64,
        page_size: i64,
    ) -> Result<postgres::Page<Self>> {
        use postgres::Order;
        use postgres::ops::UuidOp;
        Self::repository()
            .find(
                Self::query()
                    .post_id(UuidOp::Eq(post_id))
                    .filter(|c| c.parent_comment_id.is_null())
                    .order_by(PostCommentColumn::CreatedAt, Order::Desc)
                    .page(page)
                    .page_size(page_size),
            )
            .await
            .map_err(crate::common::Error::from)
    }

    /// Replies to a parent comment, newest first. `page` is 1-based.
    pub async fn list_by_comment(
        parent_comment_id: Uuid,
        page: i64,
        page_size: i64,
    ) -> Result<postgres::Page<Self>> {
        use postgres::Order;
        use postgres::ops::UuidOp;
        Self::repository()
            .find(
                Self::query()
                    .parent_comment_id(UuidOp::Eq(parent_comment_id))
                    .order_by(PostCommentColumn::CreatedAt, Order::Desc)
                    .page(page)
                    .page_size(page_size),
            )
            .await
            .map_err(crate::common::Error::from)
    }

    /// Atomic `likes` bump on a comment, on the given transaction.
    pub async fn bump_likes_tx(tx: &postgres::Tx, comment_id: Uuid, delta: i64) -> Result<()> {
        Self::bump_counter_tx(tx, comment_id, "likes", delta).await
    }

    async fn bump_counter_tx(
        tx: &postgres::Tx,
        comment_id: Uuid,
        column: &str,
        delta: i64,
    ) -> Result<()> {
        use postgres::sqlx::{Postgres, QueryBuilder};
        let table = Self::table_name();
        let mut qb = QueryBuilder::<Postgres>::new(format!(
            "UPDATE \"{table}\" SET \"{column}\" = \"{column}\" + "
        ));
        postgres::Value::from(delta).push_bind(&mut qb);
        qb.push(" WHERE \"id\" = ");
        postgres::Value::from(comment_id).push_bind(&mut qb);
        Self::repository()
            .with_tx(tx)
            .db()
            .execute(qb)
            .await
            .map_err(crate::common::Error::from)?;
        Ok(())
    }

    /// Create a reply to `parent_comment_id`. Atomically: insert the reply,
    /// increment the parent comment's `replies`, and increment the post's
    /// `comments` — mirrors the original three-way DynamoDB transact.
    pub async fn reply(
        post_id: Uuid,
        parent_comment_id: Uuid,
        content: String,
        images: Vec<String>,
        user: User,
    ) -> Result<Self> {
        let mut comment = Self::new(post_id, content, images, user);
        comment.parent_comment_id = Some(parent_comment_id);

        let tx = postgres::Tx::begin()
            .await
            .map_err(crate::common::Error::from)?;

        Self::bump_counter_tx(&tx, parent_comment_id, "replies", 1)
            .await
            .map_err(|e| {
                crate::error!("reply failed: {e}");
                PostError::ReplyFailed
            })?;

        Post::bump_comments_tx(&tx, post_id, 1).await.map_err(|e| {
            crate::error!("reply failed: {e}");
            PostError::ReplyFailed
        })?;

        Self::repository()
            .with_tx(&tx)
            .insert(&comment)
            .await
            .map_err(|e| {
                crate::error!("reply failed: {e}");
                PostError::ReplyFailed
            })?;

        tx.commit().await.map_err(|e| {
            crate::error!("reply commit failed: {e}");
            PostError::ReplyFailed
        })?;

        Ok(comment)
    }
}
