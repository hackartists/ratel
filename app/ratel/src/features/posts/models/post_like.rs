use crate::features::posts::types::*;
use crate::features::posts::*;

#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
use uuid::Uuid;

/// A user's like on a post.
///
/// Postgres migration: the DynamoDB identity `(pk = PostLike(feed_id),
/// sk = PostLike(user_id))` collapses to a surrogate `id` PK plus the natural
/// key `unique(post_id, user_pk)`. `post_id` is the feed post's UUID;
/// `user_pk` is the full `Partition` string of the liker (`"USER#..."`). Both
/// are cross-feature references — plain columns, no `references=` FK yet.
#[cfg(feature = "server")]
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, PostgresEntity)]
#[postgres(table = "post_likes", unique(post_id, user_pk))]
pub struct PostLike {
    pub id: Uuid,

    #[postgres(index)]
    pub post_id: Uuid,

    #[postgres(index)]
    pub user_pk: String,

    #[postgres(order)]
    pub created_at: i64,
}

#[cfg(feature = "server")]
impl PostLike {
    pub fn new(post_id: Uuid, user_pk: String) -> Self {
        Self {
            id: Uuid::now_v7(),
            post_id,
            user_pk,
            created_at: chrono::Utc::now().timestamp(),
        }
    }

    /// Parse a feed post `Partition` into its bare UUID. Panics on a
    /// non-`Feed` partition — mirrors the original `keys` invariant.
    pub fn feed_uuid(post_pk: &Partition) -> Uuid {
        match post_pk {
            Partition::Feed(s) if !s.is_empty() => Uuid::parse_str(s)
                .unwrap_or_else(|_| panic!("post feed id is not a uuid: {s}")),
            _ => panic!("post_pk must be Partition::Feed with a non-empty uuid value"),
        }
    }

    /// The single like row for `(post, user)`, if any.
    pub async fn find_one(post_id: Uuid, user_pk: &Partition) -> Result<Option<Self>> {
        use postgres::ops::{StringOp, UuidOp};
        Self::repository()
            .find_one(
                Self::query()
                    .post_id(UuidOp::Eq(post_id))
                    .user_pk(StringOp::Eq(user_pk.to_string())),
            )
            .await
            .map_err(crate::common::Error::from)
    }

    /// Insert a like row (idempotent on the `(post_id, user_pk)` natural key).
    pub async fn add(post_id: Uuid, user_pk: String) -> Result<()> {
        let row = Self::new(post_id, user_pk);
        Self::repository()
            .upsert_on(&["post_id", "user_pk"], &row)
            .await
            .map_err(crate::common::Error::from)?;
        Ok(())
    }

    /// Delete the like row for `(post, user)`, if present. Idempotent.
    pub async fn remove(post_id: Uuid, user_pk: &Partition) -> Result<()> {
        if let Some(row) = Self::find_one(post_id, user_pk).await? {
            Self::repository()
                .delete(row.id)
                .await
                .map_err(crate::common::Error::from)?;
        }
        Ok(())
    }

    /// Which of `post_ids` the given user has liked. Replaces the DynamoDB
    /// `batch_get` of per-post like keys with a single indexed query.
    pub async fn liked_post_ids(
        user_pk: &Partition,
        post_ids: Vec<Uuid>,
    ) -> Result<std::collections::HashSet<Uuid>> {
        use postgres::ops::{StringOp, UuidOp};
        if post_ids.is_empty() {
            return Ok(Default::default());
        }
        let page = Self::repository()
            .find(
                Self::query()
                    .user_pk(StringOp::Eq(user_pk.to_string()))
                    .post_id(UuidOp::In(post_ids)),
            )
            .await
            .map_err(crate::common::Error::from)?;
        Ok(page.items.into_iter().map(|l| l.post_id).collect())
    }
}
