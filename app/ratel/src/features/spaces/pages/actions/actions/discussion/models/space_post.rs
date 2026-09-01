use crate::features::spaces::pages::actions::actions::discussion::*;
#[cfg(feature = "server")]
use crate::features::spaces::pages::actions::actions::discussion::models::{
    SpacePostComment, SpacePostCommentLike,
};
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
use postgres::ops::StringOp;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

/// jsonb wrapper for the embedded `Vec<File>` column. Cross-platform because
/// `SpacePost` is returned to the web client.
#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "server", derive(postgres::PostgresJson))]
#[serde(transparent)]
pub struct PostFiles(pub Vec<File>);

impl std::ops::Deref for PostFiles {
    type Target = Vec<File>;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

/// A discussion (post) in a space.
///
/// Postgres migration: the DynamoDB identity was `pk = SpacePartition` +
/// `sk = SpacePost#{uuid}`, with GSIs ordering by `updated_at` (per-space and
/// per-category). It becomes a surrogate `id` PK plus `(space_id, post_id)`
/// natural key; the ordered listings become `ORDER BY updated_at DESC`
/// queries. Stays cross-platform (returned raw to the client). `user_pk` is a
/// cross-feature ref stored as its full `Partition` string.
#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq, Eq)]
// Serialize through `SpacePostWire` so the shipped mobile build still finds the
// legacy `pk`/`sk` keys. See `SpacePostWire`.
#[serde(into = "SpacePostWire")]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "server", derive(postgres::PostgresEntity))]
#[cfg_attr(feature = "server", postgres(table = "space_posts", unique(space_id, post_id)))]
pub struct SpacePost {
    #[serde(default)]
    pub id: uuid::Uuid,

    #[cfg_attr(feature = "server", postgres(index))]
    pub space_id: String,
    pub post_id: String,

    pub created_at: i64,
    #[cfg_attr(feature = "server", postgres(order))]
    pub updated_at: i64,

    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub html_contents: String,
    #[serde(default)]
    pub category_name: String,
    pub comments: i64,

    /// Author as full `Partition` string (`USER#…` / `TEAM#…`).
    pub user_pk: String,
    pub author_display_name: String,
    pub author_profile_url: String,
    pub author_username: String,

    #[serde(default)]
    pub files: PostFiles,
}

#[cfg(feature = "server")]
impl SpacePost {
    pub fn new(
        space_pk: SpacePartition,
        title: String,
        html_contents: String,
        category_name: String,
        author: &crate::common::models::space::SpaceUser,
        _started_at: Option<i64>,
        _ended_at: Option<i64>,
    ) -> Self {
        let now = crate::common::utils::time::get_now_timestamp_millis();
        let post_id = uuid::Uuid::now_v7().to_string();
        Self {
            id: uuid::Uuid::now_v7(),
            space_id: space_pk.0,
            post_id,
            created_at: now,
            updated_at: now,
            title,
            html_contents,
            category_name,
            comments: 0,
            user_pk: author.pk.to_string(),
            author_display_name: author.display_name.clone(),
            author_profile_url: author.profile_url.clone(),
            author_username: author.username.clone(),
            files: PostFiles::default(),
        }
    }

    /// The former sk value as a `SpacePostEntityType` (bare id).
    pub fn post_entity_type(&self) -> SpacePostEntityType {
        SpacePostEntityType(self.post_id.clone())
    }

    /// Fetch the discussion for `(space, post_id)`.
    pub async fn get_one(
        space_pk: &SpacePartition,
        post_id: &SpacePostPartition,
    ) -> crate::common::Result<Option<Self>> {
        Self::repository()
            .find_one(
                Self::query()
                    .space_id(StringOp::Eq(space_pk.0.clone()))
                    .post_id(StringOp::Eq(post_id.0.clone())),
            )
            .await
            .map_err(crate::common::Error::from)
    }

    /// One page of discussions for a space, newest-updated first. `bookmark`
    /// carries a 1-based page number.
    pub async fn list_by_space(
        space_pk: &SpacePartition,
        category: Option<String>,
        bookmark: Option<String>,
        limit: i64,
    ) -> crate::common::Result<(Vec<Self>, Option<String>)> {
        use postgres::Order;
        let page = bookmark
            .and_then(|b| b.parse::<i64>().ok())
            .unwrap_or(1)
            .max(1);
        let mut query = Self::query().space_id(StringOp::Eq(space_pk.0.clone()));
        if let Some(category_name) = category {
            query = query.category_name(StringOp::Eq(category_name));
        }
        let p = Self::repository()
            .find(
                query
                    .order_by(SpacePostColumn::UpdatedAt, Order::Desc)
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

    /// Public wrapper so sibling models (`SpacePostComment::reply`) can bump a
    /// discussion's `comments` counter inside a shared transaction.
    pub async fn bump_comments_public_tx(
        tx: &postgres::Tx,
        post_id: uuid::Uuid,
        delta: i64,
    ) -> crate::common::Result<()> {
        Self::bump_comments_tx(tx, post_id, delta).await
    }

    /// Atomic `comments += delta` on the given transaction.
    async fn bump_comments_tx(
        tx: &postgres::Tx,
        post_id: uuid::Uuid,
        delta: i64,
    ) -> crate::common::Result<()> {
        use postgres::sqlx::{Postgres, QueryBuilder};
        let table = Self::table_name();
        let mut qb = QueryBuilder::<Postgres>::new(format!(
            "UPDATE \"{table}\" SET \"comments\" = \"comments\" + "
        ));
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

    pub async fn comment(
        space_pk: SpacePartition,
        space_post_pk: SpacePostPartition,
        content: String,
        images: Vec<String>,
        author: &crate::common::models::space::SpaceUser,
    ) -> crate::features::spaces::pages::actions::actions::discussion::Result<SpacePostComment> {
        let post = Self::get_one(&space_pk, &space_post_pk)
            .await?
            .ok_or(SpaceActionDiscussionError::NotFound)?;
        let comment = SpacePostComment::new(space_pk, space_post_pk, content, images, author);

        let tx = postgres::Tx::begin()
            .await
            .map_err(crate::common::Error::from)?;
        SpacePostComment::repository()
            .with_tx(&tx)
            .insert(&comment)
            .await
            .map_err(|e| {
                crate::error!("Failed to add comment: {}", e);
                SpaceActionDiscussionError::CreateFailed
            })?;
        Self::bump_comments_tx(&tx, post.id, 1).await.map_err(|e| {
            crate::error!("Failed to add comment: {}", e);
            SpaceActionDiscussionError::CreateFailed
        })?;
        tx.commit().await.map_err(|e| {
            crate::error!("Failed to add comment: {}", e);
            SpaceActionDiscussionError::CreateFailed
        })?;

        Ok(comment)
    }

    pub async fn like_comment(
        space_post_pk: SpacePostPartition,
        comment_pk: EntityType,
        user_pk: UserPartition,
    ) -> crate::features::spaces::pages::actions::actions::discussion::Result<()> {
        let comment = SpacePostComment::get_by_entity(&space_post_pk, &comment_pk)
            .await?
            .ok_or(SpaceActionDiscussionError::NotFound)?;

        let like = SpacePostCommentLike::new(space_post_pk, comment_pk, user_pk);

        let tx = postgres::Tx::begin()
            .await
            .map_err(crate::common::Error::from)?;
        SpacePostCommentLike::repository()
            .with_tx(&tx)
            .insert(&like)
            .await
            .map_err(|e| {
                crate::error!("Failed to like comment: {}", e);
                SpaceActionDiscussionError::CreateFailed
            })?;
        SpacePostComment::bump_likes_tx(&tx, comment.id, 1)
            .await
            .map_err(|e| {
                crate::error!("Failed to like comment: {}", e);
                SpaceActionDiscussionError::CreateFailed
            })?;
        tx.commit().await.map_err(|e| {
            crate::error!("Failed to like comment: {}", e);
            SpaceActionDiscussionError::CreateFailed
        })?;

        Ok(())
    }

    pub async fn unlike_comment(
        space_post_pk: SpacePostPartition,
        comment_pk: EntityType,
        user_pk: UserPartition,
    ) -> crate::features::spaces::pages::actions::actions::discussion::Result<()> {
        let comment = SpacePostComment::get_by_entity(&space_post_pk, &comment_pk)
            .await?
            .ok_or(SpaceActionDiscussionError::NotFound)?;

        let like = SpacePostCommentLike::new(space_post_pk, comment_pk, user_pk);

        let tx = postgres::Tx::begin()
            .await
            .map_err(crate::common::Error::from)?;
        if let Some(existing) = SpacePostCommentLike::find_like(&like).await? {
            SpacePostCommentLike::repository()
                .with_tx(&tx)
                .delete(existing.id)
                .await
                .map_err(|e| {
                    crate::error!("Failed to unlike comment: {}", e);
                    SpaceActionDiscussionError::DeleteFailed
                })?;
        }
        SpacePostComment::bump_likes_tx(&tx, comment.id, -1)
            .await
            .map_err(|e| {
                crate::error!("Failed to unlike comment: {}", e);
                SpaceActionDiscussionError::DeleteFailed
            })?;
        tx.commit().await.map_err(|e| {
            crate::error!("Failed to unlike comment: {}", e);
            SpaceActionDiscussionError::DeleteFailed
        })?;

        Ok(())
    }
}

#[cfg(feature = "server")]
impl From<(SpacePost, SpaceUserRole)>
    for crate::features::spaces::pages::actions::types::SpaceActionSummary
{
    fn from((post, _role): (SpacePost, SpaceUserRole)) -> Self {
        use crate::features::spaces::pages::actions::types::SpaceActionType;
        let action_id = post.post_id;
        Self {
            user_participated: false,
            action_id,
            action_type: SpaceActionType::TopicDiscussion,
            title: post.title,
            description: String::new(),
            created_at: post.created_at,
            updated_at: post.updated_at,
            total_score: None,
            total_point: None,
            quiz_score: None,
            quiz_total_score: None,
            quiz_passed: None,
            credits: 0,
            prerequisite: false,
            comment_count: Some(post.comments),
            status: None,
            depends_on: Vec::new(),
            dependencies_met: true,
        }
    }
}

impl SpacePost {
    pub fn status_from(
        action_status: Option<&crate::features::spaces::pages::actions::types::SpaceActionStatus>,
    ) -> DiscussionStatus {
        use crate::features::spaces::pages::actions::types::SpaceActionStatus;
        match action_status {
            Some(SpaceActionStatus::Ongoing) => DiscussionStatus::InProgress,
            Some(SpaceActionStatus::Finish) => DiscussionStatus::Finish,
            _ => DiscussionStatus::NotStarted,
        }
    }

    pub fn can_view(
        _user_role: &SpaceUserRole,
    ) -> crate::features::spaces::pages::actions::actions::discussion::Result<()> {
        Ok(())
    }

    pub fn can_edit(
        user_role: &SpaceUserRole,
    ) -> crate::features::spaces::pages::actions::actions::discussion::Result<()> {
        match user_role {
            SpaceUserRole::Creator => Ok(()),
            _ => Err(
                crate::features::spaces::pages::actions::actions::discussion::Error::NoPermission,
            ),
        }
    }

    pub fn can_participate(
        action_status: Option<&crate::features::spaces::pages::actions::types::SpaceActionStatus>,
        user_role: &SpaceUserRole,
    ) -> crate::features::spaces::pages::actions::actions::discussion::Result<()> {
        match user_role {
            SpaceUserRole::Creator | SpaceUserRole::Participant => {
                if Self::status_from(action_status) == DiscussionStatus::InProgress {
                    Ok(())
                } else {
                    Err(
                        crate::features::spaces::pages::actions::actions::discussion::Error::DiscussionNotInProgress,
                    )
                }
            }
            _ => Err(
                crate::features::spaces::pages::actions::actions::discussion::Error::NoPermission,
            ),
        }
    }
}

/// Wire form of [`SpacePost`] — identical plus the legacy `pk`/`sk` keys.
///
/// Same reason as `UserWire`: the shipped mobile build declares `pk: Partition`
/// and `sk: EntityType` as REQUIRED. `SpacePost` reaches that build nested in
/// `DiscussionResponse`, so without these two keys the whole discussion — and
/// with it the space screen that renders its action cards — fails to parse.
///
/// The DynamoDB identity was `pk = SpacePartition` + `sk = SpacePost#{uuid}`,
/// both recoverable from the `(space_id, post_id)` natural key.
///
/// `user_pk` needs no bridging (it holds the same prefixed `Partition` string)
/// and `files` is a `#[serde(transparent)]` newtype over the old `Vec<File>`.
#[derive(Serialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub struct SpacePostWire {
    /// `Partition::Space(space_id)` — renders as `SPACE#{space_id}`.
    pub pk: Partition,
    /// `EntityType::SpacePost(post_id)` — renders as `SPACE_POST#{post_id}`.
    pub sk: EntityType,

    pub id: uuid::Uuid,
    pub space_id: String,
    pub post_id: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub title: String,
    pub html_contents: String,
    pub category_name: String,
    pub comments: i64,
    pub user_pk: String,
    pub author_display_name: String,
    pub author_profile_url: String,
    pub author_username: String,
    pub files: PostFiles,
}

impl From<SpacePost> for SpacePostWire {
    fn from(p: SpacePost) -> Self {
        Self {
            pk: Partition::Space(p.space_id.clone()),
            sk: EntityType::SpacePost(p.post_id.clone()),

            id: p.id,
            space_id: p.space_id,
            post_id: p.post_id,
            created_at: p.created_at,
            updated_at: p.updated_at,
            title: p.title,
            html_contents: p.html_contents,
            category_name: p.category_name,
            comments: p.comments,
            user_pk: p.user_pk,
            author_display_name: p.author_display_name,
            author_profile_url: p.author_profile_url,
            author_username: p.author_username,
            files: p.files,
        }
    }
}

#[cfg(test)]
mod shipped_client_compat_tests {
    use super::*;

    /// The identity fields the shipped mobile build declares on `SpacePost`.
    #[derive(Debug, serde::Deserialize)]
    #[allow(dead_code)]
    struct ShippedKeys {
        pk: Partition,
        sk: EntityType,
        title: String,
    }

    #[test]
    fn shipped_build_can_parse_current_space_post() {
        let p = SpacePost {
            space_id: "sp1".into(),
            post_id: "po1".into(),
            title: "t".into(),
            ..Default::default()
        };
        let json = serde_json::to_value(&p).expect("serialize");
        assert_eq!(json["pk"], serde_json::json!("SPACE#sp1"));
        assert_eq!(json["sk"], serde_json::json!("SPACE_POST#po1"));
        serde_json::from_value::<ShippedKeys>(json).expect("shipped build must parse this");
    }

    #[test]
    fn shipped_build_breaks_without_legacy_keys() {
        let mut json = serde_json::to_value(SpacePost::default()).expect("serialize");
        json.as_object_mut().unwrap().remove("pk");
        let err = serde_json::from_value::<ShippedKeys>(json).expect_err("must fail");
        assert!(err.to_string().contains("missing field `pk`"), "got: {err}");
    }
}
