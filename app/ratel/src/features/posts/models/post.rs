use super::pg_json::{AuthorTypeJson, BodyJson, FileVec, SpaceVisibilityJson, StringVec};
use crate::features::posts::types::*;
use crate::features::posts::*;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[cfg(feature = "server")]
use postgres::PostgresEntity;
use uuid::Uuid;

#[cfg(feature = "server")]
use super::{PostComment, PostCommentLike, PostLike, Team};

/// A post (feed item).
///
/// Postgres migration: the DynamoDB single-table identity `(pk = Feed(uuid),
/// sk = Post)` collapses to a surrogate `id` PK equal to the former feed UUID —
/// so the wire `FeedPartition` is still `id.to_string()`. The many GSIs
/// (`find_by_user_pk`, `find_by_visibility`, `find_by_user_and_status`, …)
/// become plain indexed columns queried with `ORDER BY`.
///
/// Cross-feature reference fields that used to be `Partition`/`EntityType` are
/// stored as their full prefixed string form (`user_pk` = `"USER#..."` /
/// `"TEAM#..."`, `space_pk` = `"SPACE#..."`). Because `Partition` serializes via
/// `SerializeDisplay`, a `String` column holding that same string is
/// **wire-identical** — the fullstack JSON payload is unchanged.
///
/// This struct stays cross-platform (embedded in the `PostDetailResponse` wire
/// type); only the `PostgresEntity` derive + the model `impl` are server-gated.
/// Composite/foreign fields are stored as JSONB via serde-transparent newtypes
/// (`BodyJson`, `StringVec`, `FileVec`, `AuthorTypeJson`, `SpaceVisibilityJson`)
/// and the in-path enums (`PostType`, `PostStatus`, `Visibility`, `SpaceType`,
/// `BoosterType`) that carry their own `PostgresJson` codec.
#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "server", derive(PostgresEntity))]
#[cfg_attr(feature = "server", postgres(table = "posts"))]
pub struct Post {
    pub id: Uuid,

    #[cfg_attr(feature = "server", postgres(order))]
    pub created_at: i64,
    pub updated_at: i64,

    pub title: String,
    #[serde(alias = "html_contents")]
    pub body: BodyJson,
    pub post_type: PostType,

    pub status: PostStatus,

    pub visibility: Option<Visibility>,

    pub shares: i64,
    pub likes: i64,
    pub comments: i64,

    #[serde(default)]
    pub reports: i64,

    /// Author partition string (`"USER#..."` / `"TEAM#..."`). Indexed for the
    /// by-user / by-team feed queries. Cross-feature reference — plain column.
    #[cfg_attr(feature = "server", postgres(index))]
    pub user_pk: String,
    pub author_display_name: String,
    pub author_profile_url: String,
    pub author_username: String,
    pub author_type: AuthorTypeJson,

    /// Attached space partition string (`"SPACE#..."`), if any.
    pub space_pk: Option<String>,
    pub space_type: Option<SpaceType>,
    pub space_visibility: Option<SpaceVisibilityJson>,
    pub booster: Option<BoosterType>,
    pub rewards: Option<i64>,

    pub urls: StringVec,

    /// File attachments associated with this Post (name, size, url, ext).
    #[serde(default)]
    pub attachments: FileVec,

    #[serde(default, alias = "category")]
    pub categories: StringVec,

    // Sub-team announcement fan-out linkage.
    #[serde(default)]
    pub announcement_id: Option<String>,
    #[serde(default)]
    pub announcement_parent_team_id: Option<String>,
    #[serde(default)]
    pub pinned_as_announcement: bool,
}

impl Post {
    /// The feed post's `FeedPartition` wire id (`id.to_string()`).
    pub fn feed_id(&self) -> String {
        self.id.to_string()
    }
}

#[cfg(feature = "server")]
impl Post {
    pub fn draft(author: Author) -> Self {
        Self::new("", "", PostType::Post, author)
    }

    pub fn new<T: Into<String>>(
        title: T,
        html_contents: T,
        post_type: PostType,
        author: Author,
    ) -> Self {
        let now = chrono::Utc::now().timestamp_millis();
        let Author {
            pk,
            display_name,
            profile_url,
            username,
            user_type,
        } = author;

        Self {
            id: Uuid::now_v7(),
            created_at: now,
            updated_at: now,
            post_type,
            title: title.into(),
            body: BodyJson(ContentBody::html(html_contents.into())),
            status: PostStatus::Draft,
            visibility: None,
            shares: 0,
            likes: 0,
            comments: 0,
            reports: 0,

            user_pk: pk.to_string(),
            author_display_name: display_name,
            author_profile_url: profile_url,
            author_username: username,
            author_type: AuthorTypeJson(user_type),

            space_pk: None,
            space_type: None,
            booster: None,
            rewards: None,
            urls: StringVec(vec![]),
            attachments: FileVec(vec![]),
            space_visibility: None,
            categories: StringVec(vec![]),
            announcement_id: None,
            announcement_parent_team_id: None,
            pinned_as_announcement: false,
        }
    }

    /// The author partition parsed back into a `Partition` (`"USER#..."` /
    /// `"TEAM#..."`).
    pub fn author_partition(&self) -> Partition {
        self.user_pk
            .parse::<Partition>()
            .unwrap_or_else(|_| Partition::User(self.user_pk.clone()))
    }

    /// Fetch a post by its feed UUID.
    pub async fn get_by_feed_id(post_id: Uuid) -> Result<Option<Self>> {
        Self::repository()
            .get(post_id)
            .await
            .map_err(crate::common::Error::from)
    }

    /// Batch-fetch posts by feed UUID, preserving no particular order.
    pub async fn get_many(post_ids: Vec<Uuid>) -> Result<Vec<Self>> {
        use postgres::col::UuidCol;
        if post_ids.is_empty() {
            return Ok(vec![]);
        }
        // `id` is the PK, so it has no generated query-column method — filter
        // through the `Cols` closure instead.
        Ok(Self::repository()
            .find(Self::query().filter(|c| c.id.in_(post_ids)))
            .await
            .map_err(crate::common::Error::from)?
            .items)
    }

    /// Delete a post by feed UUID, returning the deleted row.
    pub async fn delete_by_feed_id(post_id: Uuid) -> Result<Self> {
        Self::repository()
            .delete_returning(post_id)
            .await
            .map_err(crate::common::Error::from)
    }

    /// Persist changes to an existing post (full-row upsert on the PK).
    pub async fn save(&self) -> Result<Self> {
        Self::repository()
            .upsert(self)
            .await
            .map_err(crate::common::Error::from)
    }

    /// `cli` is still required because team permission resolution reads the
    /// (un-migrated, DynamoDB) `auth::UserTeam` membership rows.
    pub async fn get_permissions(
        &self,
        cli: &aws_sdk_dynamodb::Client,
        user: Option<crate::features::auth::User>,
    ) -> Result<TeamGroupPermissions> {
        if user.is_none() {
            return Ok(self.get_permissions_for_guest());
        }

        let user = user.unwrap();
        let author_pk = self.author_partition();

        if author_pk == user.pk() {
            return Ok(TeamGroupPermissions::all());
        }

        if self.author_type.0 == crate::common::types::UserType::Individual {
            return Ok(self.get_permissions_for_guest());
        }

        let gperm = self.get_permissions_for_guest();
        let perm = match author_pk {
            team_pk if matches!(team_pk, Partition::Team(_)) => {
                Team::get_permissions_by_team_pk(cli, &team_pk, &user.pk()).await? | gperm
            }
            _ => gperm,
        };

        Ok(perm)
    }

    fn get_permissions_for_guest(&self) -> TeamGroupPermissions {
        if self.status == PostStatus::Published && self.visibility == Some(Visibility::Public) {
            if self.space_visibility.as_ref().map(|v| &v.0)
                == Some(&crate::common::types::SpaceVisibility::Public)
            {
                return TeamGroupPermissions::read();
            } else {
                return TeamGroupPermissions(vec![TeamGroupPermission::PostRead]);
            }
        }

        TeamGroupPermissions::empty()
    }

    pub async fn is_liked(&self, user_pk: &Partition) -> Result<bool> {
        Ok(PostLike::find_one(self.id, user_pk).await?.is_some())
    }

    /// Load a post by feed UUID and resolve whether `user_pk` holds `perm`.
    /// `cli` is still required for the (DynamoDB) team-membership lookup.
    pub async fn has_permission(
        cli: &aws_sdk_dynamodb::Client,
        post_id: Uuid,
        user_pk: Option<&Partition>,
        perm: TeamGroupPermission,
    ) -> Result<(Self, bool)> {
        let post = Post::get_by_feed_id(post_id)
            .await?
            .ok_or(Error::NotFound("Post not found".into()))?;

        if post.status == PostStatus::Published && post.visibility == Some(Visibility::Public) {
            return Ok((post, true));
        }

        if user_pk.is_none() {
            return Ok((post, false));
        }

        let user_pk = user_pk.unwrap();

        match post.author_partition() {
            Partition::Team(pk) => {
                let has_perm =
                    Team::has_permission(cli, &Partition::Team(pk.clone()), user_pk, perm).await?;
                Ok((post, has_perm))
            }
            Partition::User(_) => {
                let has_perm = post.author_partition() == *user_pk;
                Ok((post, has_perm))
            }
            _ => Err(PostError::InvalidAuthor.into()),
        }
    }

    /// Atomic counter bump on a single post column (`likes`/`comments`/`shares`/
    /// `reports`), executed on the given transaction. Replaces the DynamoDB
    /// atomic `ADD` — `SET col = col + $delta` is done in SQL (never
    /// read-modify-write), preserving concurrency semantics.
    async fn bump_counter_tx(
        tx: &postgres::Tx,
        post_id: Uuid,
        column: &str,
        delta: i64,
    ) -> Result<()> {
        use postgres::sqlx::{Postgres, QueryBuilder};
        let table = Self::table_name();
        // `column` is a fixed internal literal, never user input.
        let mut qb =
            QueryBuilder::<Postgres>::new(format!("UPDATE \"{table}\" SET \"{column}\" = \"{column}\" + "));
        postgres::Value::from(delta).push_bind(&mut qb);
        qb.push(" WHERE \"id\" = ");
        postgres::Value::from(post_id).push_bind(&mut qb);
        Self::repository()
            .with_tx(tx)
            .db()
            .execute(qb)
            .await
            .map_err(crate::common::Error::from)?;
        Ok(())
    }

    /// Public wrapper so sibling models (`PostComment::reply`) can bump a post's
    /// `comments` counter inside a shared transaction.
    pub async fn bump_comments_tx(tx: &postgres::Tx, post_id: Uuid, delta: i64) -> Result<()> {
        Self::bump_counter_tx(tx, post_id, "comments", delta).await
    }

    pub async fn like(post_id: Uuid, user_pk: Partition) -> Result<()> {
        tracing::debug!("Liking post {} by user {}", post_id, user_pk);
        let tx = postgres::Tx::begin().await.map_err(crate::common::Error::from)?;
        Self::bump_counter_tx(&tx, post_id, "likes", 1).await.map_err(|e| {
            crate::error!("like post failed: {e}");
            PostError::LikeFailed
        })?;
        let pl = PostLike::new(post_id, user_pk.to_string());
        PostLike::repository()
            .with_tx(&tx)
            .upsert_on(&["post_id", "user_pk"], &pl)
            .await
            .map_err(|e| {
                crate::error!("like post failed: {e}");
                PostError::LikeFailed
            })?;
        tx.commit().await.map_err(|e| {
            crate::error!("like post commit failed: {e}");
            PostError::LikeFailed
        })?;
        Ok(())
    }

    pub async fn unlike(post_id: Uuid, user_pk: Partition) -> Result<()> {
        let tx = postgres::Tx::begin().await.map_err(crate::common::Error::from)?;
        Self::bump_counter_tx(&tx, post_id, "likes", -1).await.map_err(|e| {
            crate::error!("unlike post failed: {e}");
            PostError::UnlikeFailed
        })?;
        if let Some(row) = PostLike::find_one(post_id, &user_pk).await? {
            let _ = PostLike::repository()
                .with_tx(&tx)
                .delete(row.id)
                .await;
        }
        tx.commit().await.map_err(|e| {
            crate::error!("unlike post commit failed: {e}");
            PostError::UnlikeFailed
        })?;
        Ok(())
    }

    pub async fn comment(
        post_id: Uuid,
        content: String,
        images: Vec<String>,
        user: crate::features::auth::User,
    ) -> Result<PostComment> {
        let comment = PostComment::new(post_id, content, images, user);
        let tx = postgres::Tx::begin().await.map_err(crate::common::Error::from)?;
        Self::bump_counter_tx(&tx, post_id, "comments", 1).await.map_err(|e| {
            crate::error!("add comment failed: {e}");
            PostError::CommentFailed
        })?;
        PostComment::repository()
            .with_tx(&tx)
            .insert(&comment)
            .await
            .map_err(|e| {
                crate::error!("add comment failed: {e}");
                PostError::CommentFailed
            })?;
        tx.commit().await.map_err(|e| {
            crate::error!("add comment commit failed: {e}");
            PostError::CommentFailed
        })?;

        Ok(comment)
    }

    pub async fn like_comment(
        post_id: Uuid,
        comment_id: Uuid,
        user_pk: Partition,
    ) -> Result<()> {
        let tx = postgres::Tx::begin().await.map_err(crate::common::Error::from)?;
        PostComment::bump_likes_tx(&tx, comment_id, 1).await.map_err(|e| {
            crate::error!("like comment failed: {e}");
            PostError::CommentLikeFailed
        })?;
        let pcl = PostCommentLike::new(post_id, comment_id, user_pk.to_string());
        PostCommentLike::repository()
            .with_tx(&tx)
            .upsert_on(&["comment_id", "user_pk"], &pcl)
            .await
            .map_err(|e| {
                crate::error!("like comment failed: {e}");
                PostError::CommentLikeFailed
            })?;
        tx.commit().await.map_err(|e| {
            crate::error!("like comment commit failed: {e}");
            PostError::CommentLikeFailed
        })?;
        Ok(())
    }

    pub async fn unlike_comment(
        _post_id: Uuid,
        comment_id: Uuid,
        user_pk: Partition,
    ) -> Result<()> {
        let tx = postgres::Tx::begin().await.map_err(crate::common::Error::from)?;
        PostComment::bump_likes_tx(&tx, comment_id, -1).await.map_err(|e| {
            crate::error!("unlike comment failed: {e}");
            PostError::CommentUnlikeFailed
        })?;
        if let Some(row) = PostCommentLike::find_one(comment_id, &user_pk).await? {
            let _ = PostCommentLike::repository()
                .with_tx(&tx)
                .delete(row.id)
                .await;
        }
        tx.commit().await.map_err(|e| {
            crate::error!("unlike comment commit failed: {e}");
            PostError::CommentUnlikeFailed
        })?;
        Ok(())
    }

    /// Global public feed — Published + Public, newest first. `page` is 1-based.
    pub async fn find_public_feed(page: i64, page_size: i64) -> Result<postgres::Page<Self>> {
        use postgres::Order;
        use postgres::ops::JsonOp;
        Self::repository()
            .find(
                Self::query()
                    .status(JsonOp::Eq(PostStatus::Published))
                    .visibility(JsonOp::Eq(Visibility::Public))
                    .order_by(PostColumn::CreatedAt, Order::Desc)
                    .page(page)
                    .page_size(page_size),
            )
            .await
            .map_err(crate::common::Error::from)
    }

    /// Posts authored by `user_pk` with the given status (and optionally a
    /// specific visibility), newest first. `page` is 1-based. Replaces the
    /// DynamoDB `find_by_user_and_status` GSI query.
    pub async fn find_by_user_and_status(
        user_pk: &Partition,
        status: PostStatus,
        visibility: Option<Visibility>,
        page: i64,
        page_size: i64,
    ) -> Result<postgres::Page<Self>> {
        use postgres::Order;
        use postgres::ops::{JsonOp, StringOp};
        let mut q = Self::query()
            .user_pk(StringOp::Eq(user_pk.to_string()))
            .status(JsonOp::Eq(status));
        if let Some(v) = visibility {
            q = q.visibility(JsonOp::Eq(v));
        }
        Self::repository()
            .find(
                q.order_by(PostColumn::CreatedAt, Order::Desc)
                    .page(page)
                    .page_size(page_size),
            )
            .await
            .map_err(crate::common::Error::from)
    }

    pub fn is_published(&self) -> bool {
        self.status == PostStatus::Published
    }

    pub fn is_public(&self) -> bool {
        self.visibility == Some(Visibility::Public)
    }
}
