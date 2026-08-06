use crate::features::spaces::pages::actions::actions::discussion::*;
#[cfg(feature = "server")]
use crate::features::spaces::pages::actions::actions::discussion::models::comment_key_of;
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
use postgres::ops::StringOp;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;
#[cfg(feature = "server")]
use std::collections::HashSet;
#[cfg(feature = "server")]
use uuid::Uuid;

/// One like row per (comment, user).
///
/// Postgres migration: the DynamoDB identity was `pk = SpacePostLike(post_id)`
/// + `sk = SpacePostCommentLike#{user}#{comment_key}`. It becomes a surrogate
/// `id` PK plus `(post_id, comment_key, user_pk)` natural key, where
/// `comment_key` is the composite like-key (`id` or `{parent}#{reply}`).
/// Server-only.
#[cfg(feature = "server")]
#[derive(Debug, Clone, Serialize, Deserialize, Default, PostgresEntity)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[postgres(table = "space_post_comment_likes", unique(post_id, comment_key, user_pk))]
pub struct SpacePostCommentLike {
    pub id: Uuid,

    #[postgres(index)]
    pub post_id: String,
    #[postgres(index)]
    pub comment_key: String,
    #[postgres(index)]
    pub user_pk: String,

    #[postgres(order)]
    pub created_at: i64,
}

#[cfg(feature = "server")]
impl SpacePostCommentLike {
    pub fn new(
        space_post_pk: SpacePostPartition,
        comment_sk: EntityType,
        user_pk: UserPartition,
    ) -> Self {
        let now = crate::common::utils::time::get_now_timestamp_millis();
        let user_partition: Partition = user_pk.into();
        Self {
            id: Uuid::now_v7(),
            post_id: space_post_pk.0,
            comment_key: comment_key_of(&comment_sk).unwrap_or_default(),
            user_pk: user_partition.to_string(),
            created_at: now,
        }
    }

    /// Fetch the like row matching this like's natural key, if present.
    pub async fn find_like(
        like: &Self,
    ) -> crate::features::spaces::pages::actions::actions::discussion::Result<Option<Self>> {
        Self::repository()
            .find_one(
                Self::query()
                    .post_id(StringOp::Eq(like.post_id.clone()))
                    .comment_key(StringOp::Eq(like.comment_key.clone()))
                    .user_pk(StringOp::Eq(like.user_pk.clone())),
            )
            .await
            .map_err(crate::common::Error::from)
            .map_err(Into::into)
    }

    /// The set of `comment_key`s among `comment_keys` that `user_pk` has liked
    /// under `post_id`.
    pub async fn liked_keys(
        post_id: &str,
        user_pk: &Partition,
        comment_keys: Vec<String>,
    ) -> crate::common::Result<HashSet<String>> {
        if comment_keys.is_empty() {
            return Ok(HashSet::new());
        }
        let page = Self::repository()
            .find(
                Self::query()
                    .post_id(StringOp::Eq(post_id.to_string()))
                    .user_pk(StringOp::Eq(user_pk.to_string()))
                    .comment_key(StringOp::In(comment_keys)),
            )
            .await
            .map_err(crate::common::Error::from)?;
        Ok(page.items.into_iter().map(|l| l.comment_key).collect())
    }
}
