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
// Serialize through `PostCommentWire` so the shipped mobile build still finds
// the legacy `pk`/`sk`/`parent_comment_sk` keys. See `PostCommentWire`.
#[serde(into = "PostCommentWire")]
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

/// Wire form of [`PostComment`] — identical plus the keys the shipped mobile
/// build requires.
///
/// Same reason as `UserWire`/`PostWire`. That build declares `pk: Partition` and
/// `sk: EntityType` as REQUIRED, so a payload without them fails to parse and
/// every comment thread dies. It wrote `pk` as the parent post's partition
/// (`Partition::Feed(post_id)`) and `sk` as `EntityType::PostComment(id)`, so
/// both are recomputed from `post_id`/`id` rather than stored.
///
/// `parent_comment_sk` is a third bridge, and a softer one: it is `Option` in
/// that build, so its absence parses fine — but every reply would come back
/// detached and render as a top-level comment. It is the old spelling of
/// `parent_comment_id`, so it is re-emitted in the `EntityType` form.
///
/// `images` needs no bridging (`StringVec` is `#[serde(transparent)]`), nor do
/// `likes`/`replies` (`u64`→`i64` is the same JSON number for these counters),
/// nor `author_pk`, which holds the same prefixed string a `Partition`
/// serializes to.
#[derive(Serialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub struct PostCommentWire {
    /// The parent post's partition — renders as `FEED#{post_id}`.
    pub pk: Partition,
    /// `EntityType::PostComment(id)` — renders as `POST_COMMENT#{id}`.
    pub sk: EntityType,
    /// Old spelling of `parent_comment_id`, in `POST_COMMENT#{id}` form.
    pub parent_comment_sk: Option<EntityType>,

    pub id: Uuid,
    pub post_id: Uuid,
    pub parent_comment_id: Option<Uuid>,
    pub created_at: i64,
    pub updated_at: i64,
    pub content: String,
    pub images: StringVec,
    pub likes: i64,
    pub reports: i64,
    pub replies: i64,
    pub author_pk: String,
    pub author_display_name: String,
    pub author_username: String,
    pub author_profile_url: String,
}

impl From<PostComment> for PostCommentWire {
    fn from(c: PostComment) -> Self {
        Self {
            pk: Partition::Feed(c.post_id.to_string()),
            sk: EntityType::PostComment(c.id.to_string()),
            parent_comment_sk: c
                .parent_comment_id
                .map(|p| EntityType::PostComment(p.to_string())),

            id: c.id,
            post_id: c.post_id,
            parent_comment_id: c.parent_comment_id,
            created_at: c.created_at,
            updated_at: c.updated_at,
            content: c.content,
            images: c.images,
            likes: c.likes,
            reports: c.reports,
            replies: c.replies,
            author_pk: c.author_pk,
            author_display_name: c.author_display_name,
            author_username: c.author_username,
            author_profile_url: c.author_profile_url,
        }
    }
}

#[cfg(test)]
mod shipped_client_compat_tests {
    use super::*;

    /// The identity fields the shipped mobile build declares on `PostComment`,
    /// copied verbatim from commit 38ac1fcd8.
    #[derive(Debug, serde::Deserialize)]
    #[allow(dead_code)]
    struct ShippedCommentKeys {
        pk: Partition,
        sk: EntityType,
        #[serde(default)]
        parent_comment_sk: Option<EntityType>,
        content: String,
    }

    fn sample(parent: Option<Uuid>) -> PostComment {
        PostComment {
            id: Uuid::now_v7(),
            post_id: Uuid::now_v7(),
            parent_comment_id: parent,
            content: "hi".into(),
            ..Default::default()
        }
    }

    #[test]
    fn shipped_build_can_parse_current_comment() {
        let c = sample(None);
        let json = serde_json::to_value(&c).expect("serialize");

        assert_eq!(json["pk"], serde_json::json!(format!("FEED#{}", c.post_id)));
        assert_eq!(
            json["sk"],
            serde_json::json!(format!("POST_COMMENT#{}", c.id))
        );

        serde_json::from_value::<ShippedCommentKeys>(json).expect("shipped build must parse this");
    }

    /// A reply must keep its parent link under the old field name, or the shipped
    /// build renders it detached as a top-level comment.
    #[test]
    fn reply_keeps_its_parent_under_the_legacy_name() {
        let parent = Uuid::now_v7();
        let json = serde_json::to_value(sample(Some(parent))).expect("serialize");

        assert_eq!(
            json["parent_comment_sk"],
            serde_json::json!(format!("POST_COMMENT#{parent}"))
        );
    }

    #[test]
    fn shipped_build_breaks_without_legacy_keys() {
        let mut json = serde_json::to_value(sample(None)).expect("serialize");
        json.as_object_mut().unwrap().remove("pk");

        let err = serde_json::from_value::<ShippedCommentKeys>(json).expect_err("must fail");
        assert!(
            err.to_string().contains("missing field `pk`"),
            "expected missing-`pk`, got: {err}"
        );
    }
}
