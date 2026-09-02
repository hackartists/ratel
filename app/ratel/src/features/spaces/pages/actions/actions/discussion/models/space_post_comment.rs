use crate::features::spaces::pages::actions::actions::discussion::*;
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
use postgres::ops::StringOp;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

/// Value for `parent_comment_id` indicating a top-level comment (kept for
/// wire/back-compat; top-level comments store `None`).
pub const ROOT_PARENT: &str = "ROOT";

/// jsonb wrapper for the embedded `Vec<String>` image list. Cross-platform
/// because `SpacePostComment` is returned to the web client.
#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "server", derive(postgres::PostgresJson))]
#[serde(transparent)]
pub struct CommentImages(pub Vec<String>);

impl std::ops::Deref for CommentImages {
    type Target = Vec<String>;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

/// A comment (or reply) on a discussion.
///
/// Postgres migration: the DynamoDB identity was `pk = SpacePost(post_id)` +
/// `sk = SpacePostComment#{uuid}` (or `SpacePostCommentReply#{parent}#{uuid}`),
/// with GSIs ordering by likes. It becomes a surrogate `id` PK plus
/// `(post_id, comment_id)` natural key and a nullable `parent_comment_id`
/// (set for replies). The likes-ordering GSIs become `ORDER BY likes DESC`.
/// Stays cross-platform (returned raw by `update_comment`).
#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq, Eq)]
// Serialize through `SpacePostCommentWire` so the shipped mobile build still
// finds the legacy `pk`/`sk` keys. See `SpacePostCommentWire`.
#[serde(into = "SpacePostCommentWire")]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "server", derive(postgres::PostgresEntity))]
#[cfg_attr(feature = "server", postgres(table = "space_post_comments", unique(post_id, comment_id)))]
pub struct SpacePostComment {
    #[serde(default)]
    pub id: uuid::Uuid,

    #[cfg_attr(feature = "server", postgres(index))]
    pub post_id: String,
    pub comment_id: String,

    /// The parent comment's leaf id when this row is a reply; empty string for
    /// a top-level comment (avoids a nullable column — the ORM's string ops
    /// have no `IS NULL`).
    #[serde(default)]
    pub parent_comment_id: String,

    #[serde(default)]
    pub space_id: Option<String>,

    #[serde(default)]
    pub created_at: i64,
    #[serde(default)]
    pub updated_at: i64,
    #[serde(default)]
    pub content: String,

    #[serde(default)]
    pub images: CommentImages,

    #[serde(default)]
    pub likes: i64,
    #[serde(default)]
    pub replies: i64,

    /// Moderation: auto-hidden (report threshold reached) or admin-hidden.
    /// Excluded from every listing.
    ///
    /// `version = 1`: added after the v0 baseline, so an EXISTING database gets
    /// `ALTER TABLE ... ADD COLUMN` instead of a v0 checksum mismatch (which
    /// would abort startup). `bool` gets an automatic `DEFAULT FALSE`, so rows
    /// written by an older server still satisfy the NOT NULL constraint.
    #[serde(default)]
    #[cfg_attr(feature = "server", postgres(version = 1))]
    pub hidden: bool,
    /// Distinct reporters of this comment — drives the auto-hide threshold.
    /// `version = 1` for the same reason; integers default to `0`.
    #[serde(default)]
    #[cfg_attr(feature = "server", postgres(version = 1))]
    pub report_count: i64,

    /// Author as full `Partition` string (`USER#…`).
    #[cfg_attr(feature = "server", postgres(index))]
    pub author_pk: String,
    pub author_display_name: String,
    pub author_username: String,
    pub author_profile_url: String,
}

/// Leaf id of a comment `EntityType` (the reply id for replies).
#[cfg(feature = "server")]
pub(crate) fn comment_leaf_of(sk: &EntityType) -> Option<String> {
    match sk {
        EntityType::SpacePostComment(id) => Some(id.clone()),
        EntityType::SpacePostCommentReply(_, reply) => Some(reply.clone()),
        _ => None,
    }
}

/// Composite "like key" of a comment `EntityType` — `id` for comments,
/// `{parent}#{reply}` for replies (mirrors the old like sort-key inner).
#[cfg(feature = "server")]
pub(crate) fn comment_key_of(sk: &EntityType) -> Option<String> {
    match sk {
        EntityType::SpacePostComment(id) => Some(id.clone()),
        EntityType::SpacePostCommentReply(parent, reply) => Some(format!("{parent}#{reply}")),
        _ => None,
    }
}

#[cfg(feature = "server")]
impl SpacePostComment {
    pub fn new(
        space_pk: SpacePartition,
        space_post_sk: SpacePostPartition,
        content: String,
        images: Vec<String>,
        author: &crate::common::models::space::SpaceUser,
    ) -> Self {
        use crate::common::utils::time::get_now_timestamp;

        let comment_id = uuid::Uuid::now_v7().to_string();
        let now = get_now_timestamp();

        Self {
            id: uuid::Uuid::now_v7(),
            post_id: space_post_sk.0,
            comment_id,
            parent_comment_id: String::new(),
            space_id: Some(space_pk.0),
            created_at: now,
            updated_at: now,
            content,
            images: CommentImages(images),
            author_pk: author.pk.to_string(),
            author_display_name: author.display_name.clone(),
            author_username: author.username.clone(),
            author_profile_url: author.profile_url.clone(),
            likes: 0,
            replies: 0,
            hidden: false,
            report_count: 0,
        }
    }

    /// The comment's `EntityType` (comment vs reply) reconstructed from columns.
    pub fn comment_entity(&self) -> EntityType {
        if self.parent_comment_id.is_empty() {
            EntityType::SpacePostComment(self.comment_id.clone())
        } else {
            EntityType::SpacePostCommentReply(
                self.parent_comment_id.clone(),
                self.comment_id.clone(),
            )
        }
    }

    /// The owning discussion partition reconstructed from `post_id`.
    pub fn post_partition(&self) -> Partition {
        Partition::SpacePost(self.post_id.clone())
    }

    /// Author reconstructed as a `Partition`.
    pub fn author_partition(&self) -> Partition {
        use std::str::FromStr;
        Partition::from_str(&self.author_pk).unwrap_or(Partition::None)
    }

    /// Parent comment `EntityType`, if this row is a reply.
    pub fn parent_comment_entity(&self) -> Option<EntityType> {
        if self.parent_comment_id.is_empty() {
            None
        } else {
            Some(EntityType::SpacePostComment(self.parent_comment_id.clone()))
        }
    }

    /// Composite like-key for this comment (`id` or `{parent}#{id}`).
    pub fn like_key(&self) -> String {
        if self.parent_comment_id.is_empty() {
            self.comment_id.clone()
        } else {
            format!("{}#{}", self.parent_comment_id, self.comment_id)
        }
    }

    /// Fetch a comment by its `(post, EntityType)` identity.
    pub async fn get_by_entity(
        space_post_pk: &SpacePostPartition,
        comment_pk: &EntityType,
    ) -> crate::features::spaces::pages::actions::actions::discussion::Result<Option<Self>> {
        let leaf = match comment_leaf_of(comment_pk) {
            Some(v) => v,
            None => return Err(SpaceActionDiscussionError::InvalidDiscussionId.into()),
        };
        Self::repository()
            .find_one(
                Self::query()
                    .post_id(StringOp::Eq(space_post_pk.0.clone()))
                    .comment_id(StringOp::Eq(leaf)),
            )
            .await
            .map_err(crate::common::Error::from)
            .map_err(Into::into)
    }

    /// Fetch a comment by `(post_id, leaf comment id)`.
    pub async fn get_by_leaf(
        post_id: &str,
        comment_id: &str,
    ) -> crate::common::Result<Option<Self>> {
        Self::repository()
            .find_one(
                Self::query()
                    .post_id(StringOp::Eq(post_id.to_string()))
                    .comment_id(StringOp::Eq(comment_id.to_string())),
            )
            .await
            .map_err(crate::common::Error::from)
    }

    /// Top-level comments of a discussion, newest first (paged).
    pub async fn list_top_level(
        post_id: &str,
        bookmark: Option<String>,
        limit: i64,
    ) -> crate::common::Result<(Vec<Self>, Option<String>)> {
        use postgres::Order;
        let page = bookmark
            .and_then(|b| b.parse::<i64>().ok())
            .unwrap_or(1)
            .max(1);
        let p = Self::repository()
            .find(
                Self::query()
                    .post_id(StringOp::Eq(post_id.to_string()))
                    .parent_comment_id(StringOp::Eq(String::new()))
                    .order_by(SpacePostCommentColumn::CreatedAt, Order::Desc)
                    .page(page)
                    .page_size(limit),
            )
            .await
            .map_err(crate::common::Error::from)?;
        let next = if page < p.total_pages {
            Some((page + 1).to_string())
        } else {
            None
        };
        Ok((p.items, next))
    }

    /// Top-level comments created after `since`, newest first, unpaginated.
    pub async fn list_top_level_since(
        post_id: &str,
        since: i64,
        limit: i64,
    ) -> crate::common::Result<Vec<Self>> {
        use postgres::Order;
        use postgres::ops::NumOp;
        Self::repository()
            .find(
                Self::query()
                    .post_id(StringOp::Eq(post_id.to_string()))
                    .parent_comment_id(StringOp::Eq(String::new()))
                    .created_at(NumOp::Gt(since))
                    .order_by(SpacePostCommentColumn::CreatedAt, Order::Desc)
                    .page(1)
                    .page_size(limit),
            )
            .await
            .map(|p| p.items)
            .map_err(crate::common::Error::from)
    }

    /// Replies of a comment, ordered by likes desc (paged).
    pub async fn list_by_comment(
        comment_sk: EntityType,
        bookmark: Option<String>,
        limit: i64,
    ) -> crate::features::spaces::pages::actions::actions::discussion::Result<(
        Vec<Self>,
        Option<String>,
    )> {
        use postgres::Order;
        let parent_comment_id = match comment_leaf_of(&comment_sk) {
            Some(id) => id,
            None => {
                crate::error!("Invalid parent comment sk: {:?}", comment_sk);
                return Err(SpaceActionDiscussionError::InvalidDiscussionId.into());
            }
        };
        let page = bookmark
            .and_then(|b| b.parse::<i64>().ok())
            .unwrap_or(1)
            .max(1);
        let p = Self::repository()
            .find(
                Self::query()
                    .parent_comment_id(StringOp::Eq(parent_comment_id))
                    .order_by(SpacePostCommentColumn::Likes, Order::Desc)
                    .order_by(SpacePostCommentColumn::CreatedAt, Order::Desc)
                    .page(page)
                    .page_size(limit),
            )
            .await
            .map_err(crate::common::Error::from)?;
        let next = if page < p.total_pages {
            Some((page + 1).to_string())
        } else {
            None
        };
        Ok((p.items, next))
    }

    /// Atomic `likes += delta` on the given transaction.
    pub async fn bump_likes_tx(
        tx: &postgres::Tx,
        comment_id: uuid::Uuid,
        delta: i64,
    ) -> crate::common::Result<()> {
        Self::bump_counter_tx(tx, comment_id, "likes", delta).await
    }

    /// Atomic `replies += delta` on the given transaction.
    pub async fn bump_replies_tx(
        tx: &postgres::Tx,
        comment_id: uuid::Uuid,
        delta: i64,
    ) -> crate::common::Result<()> {
        Self::bump_counter_tx(tx, comment_id, "replies", delta).await
    }

    async fn bump_counter_tx(
        tx: &postgres::Tx,
        comment_id: uuid::Uuid,
        column: &str,
        delta: i64,
    ) -> crate::common::Result<()> {
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

    pub async fn reply(
        space_pk: SpacePartition,
        space_post_pk: SpacePostPartition,
        parent_comment_sk: EntityType,
        content: String,
        images: Vec<String>,
        author: &crate::common::models::space::SpaceUser,
    ) -> crate::features::spaces::pages::actions::actions::discussion::Result<Self> {
        let parent_comment_id = match &parent_comment_sk {
            EntityType::SpacePostComment(id) => id.clone(),
            _ => {
                crate::error!("Invalid parent_comment_sk: {:?}", parent_comment_sk);
                return Err(SpaceActionDiscussionError::InvalidDiscussionId.into());
            }
        };

        let post = SpacePost::get_one(&space_pk, &space_post_pk)
            .await?
            .ok_or(SpaceActionDiscussionError::NotFound)?;
        let parent = Self::get_by_leaf(&space_post_pk.0, &parent_comment_id)
            .await?
            .ok_or(SpaceActionDiscussionError::NotFound)?;

        let mut comment = Self::new(space_pk, space_post_pk, content, images, author);
        // Replies keep the historical v4 id.
        comment.comment_id = uuid::Uuid::new_v4().to_string();
        comment.parent_comment_id = parent_comment_id;

        let tx = postgres::Tx::begin()
            .await
            .map_err(crate::common::Error::from)?;
        Self::repository()
            .with_tx(&tx)
            .insert(&comment)
            .await
            .map_err(|e| {
                crate::error!("Failed to reply comment: {}", e);
                SpaceActionDiscussionError::CreateFailed
            })?;
        Self::bump_replies_tx(&tx, parent.id, 1).await.map_err(|e| {
            crate::error!("Failed to reply comment: {}", e);
            SpaceActionDiscussionError::CreateFailed
        })?;
        SpacePost::bump_comments_public_tx(&tx, post.id, 1)
            .await
            .map_err(|e| {
                crate::error!("Failed to reply comment: {}", e);
                SpaceActionDiscussionError::CreateFailed
            })?;
        tx.commit().await.map_err(|e| {
            crate::error!("Failed to reply comment: {}", e);
            SpaceActionDiscussionError::CreateFailed
        })?;

        Ok(comment)
    }
}

/// Wire form of [`SpacePostComment`] — identical plus the legacy key fields.
///
/// Same reason as `UserWire`: the shipped mobile build declares `pk: Partition`
/// and `sk: EntityType` as REQUIRED, so a discussion thread that carries even
/// one comment fails to parse there.
///
/// The DynamoDB identity was `pk = SpacePost(post_id)` plus either
/// `sk = SpacePostComment#{id}` for a top-level comment or
/// `sk = SpacePostCommentReply#{parent}#{id}` for a reply — the reply form is
/// reconstructed here from `parent_comment_id`, which is empty for a top-level
/// comment.
///
/// `space_pk` and `parent_comment_sk` are re-emitted too. Both are `Option` in
/// that build, so their absence parses — but a reply would come back detached
/// and render as a top-level comment. The three `*_align` fields it also
/// declares are `#[serde(default)]` DynamoDB GSI sort-key helpers with no
/// meaning under Postgres, so they are deliberately left out.
///
/// `images` needs no bridging (`CommentImages` is `#[serde(transparent)]`), nor
/// do `likes`/`replies` (`u64`→`i64` is the same JSON number), nor `author_pk`,
/// which holds the same prefixed `Partition` string.
#[derive(Serialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub struct SpacePostCommentWire {
    /// `Partition::SpacePost(post_id)`.
    pub pk: Partition,
    /// `SpacePostComment#{id}`, or `SpacePostCommentReply#{parent}#{id}`.
    pub sk: EntityType,
    /// The owning space's partition, when known.
    pub space_pk: Option<Partition>,
    /// Old spelling of `parent_comment_id`, in `EntityType` form.
    pub parent_comment_sk: Option<EntityType>,

    pub id: uuid::Uuid,
    pub post_id: String,
    pub comment_id: String,
    pub parent_comment_id: String,
    pub space_id: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub content: String,
    pub images: CommentImages,
    pub likes: i64,
    pub replies: i64,
    pub hidden: bool,
    pub report_count: i64,
    pub author_pk: String,
    pub author_display_name: String,
    pub author_username: String,
    pub author_profile_url: String,
}

impl From<SpacePostComment> for SpacePostCommentWire {
    fn from(c: SpacePostComment) -> Self {
        let is_reply = !c.parent_comment_id.is_empty();
        Self {
            pk: Partition::SpacePost(c.post_id.clone()),
            sk: if is_reply {
                EntityType::SpacePostCommentReply(
                    c.parent_comment_id.clone(),
                    c.comment_id.clone(),
                )
            } else {
                EntityType::SpacePostComment(c.comment_id.clone())
            },
            space_pk: c.space_id.clone().map(Partition::Space),
            parent_comment_sk: is_reply
                .then(|| EntityType::SpacePostComment(c.parent_comment_id.clone())),

            id: c.id,
            post_id: c.post_id,
            comment_id: c.comment_id,
            parent_comment_id: c.parent_comment_id,
            space_id: c.space_id,
            created_at: c.created_at,
            updated_at: c.updated_at,
            content: c.content,
            images: c.images,
            likes: c.likes,
            replies: c.replies,
            hidden: c.hidden,
            report_count: c.report_count,
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

    /// The identity fields the shipped mobile build declares on `SpacePostComment`,
    /// copied from commit 38ac1fcd8. Neither carries `#[serde(default)]`.
    #[derive(Debug, serde::Deserialize)]
    #[allow(dead_code)]
    struct ShippedKeys {
        pk: Partition,
        sk: EntityType,
    }

    #[test]
    fn shipped_build_can_parse_current_row() {
        let v = SpacePostComment { post_id: "p1".into(), comment_id: "c1".into(), ..Default::default() };
        let json = serde_json::to_value(&v).expect("serialize");
        assert_eq!(json["pk"], serde_json::json!("SPACE_POST#p1"));
        serde_json::from_value::<ShippedKeys>(json).expect("shipped build must parse this");
    }

    #[test]
    fn shipped_build_breaks_without_legacy_keys() {
        let mut json = serde_json::to_value(SpacePostComment { post_id: "p1".into(), comment_id: "c1".into(), ..Default::default() }).expect("serialize");
        json.as_object_mut().unwrap().remove("pk");
        let err = serde_json::from_value::<ShippedKeys>(json).expect_err("must fail");
        assert!(err.to_string().contains("missing field `pk`"), "got: {err}");
    }
}
