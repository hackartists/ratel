use crate::features::spaces::pages::actions::actions::discussion::*;
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
use postgres::ops::StringOp;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;
#[cfg(feature = "server")]
use uuid::Uuid;

/// One row per (discussion, subscriber).
///
/// Postgres migration: the DynamoDB identity was `pk = SpacePost(post_id)` +
/// `sk = SpacePostSubscription#{user}`. It becomes a surrogate `id` PK plus
/// `(post_id, user_pk)` natural key. Server-only.
#[cfg(feature = "server")]
#[derive(Debug, Default, Clone, Serialize, Deserialize, PostgresEntity)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[postgres(table = "space_post_subscriptions", unique(post_id, user_pk))]
pub struct SpacePostSubscription {
    pub id: Uuid,

    #[postgres(index)]
    pub post_id: String,
    pub user_pk: String,

    pub space_id: String,
    #[postgres(order)]
    pub created_at: i64,
}

#[cfg(feature = "server")]
impl SpacePostSubscription {
    pub fn new(
        space_post_pk: SpacePostPartition,
        space_pk: SpacePartition,
        user_pk: &Partition,
    ) -> Self {
        Self {
            id: Uuid::now_v7(),
            post_id: space_post_pk.0,
            user_pk: user_pk.to_string(),
            space_id: space_pk.0,
            created_at: crate::common::utils::time::get_now_timestamp(),
        }
    }

    /// The subscription row for `(discussion, user)`, if present.
    pub async fn get_one(
        space_post_pk: &SpacePostPartition,
        user_pk: &Partition,
    ) -> crate::common::Result<Option<Self>> {
        Self::repository()
            .find_one(
                Self::query()
                    .post_id(StringOp::Eq(space_post_pk.0.clone()))
                    .user_pk(StringOp::Eq(user_pk.to_string())),
            )
            .await
            .map_err(crate::common::Error::from)
    }

    /// All subscribers of a discussion.
    pub async fn list_by_post(post_id: &str) -> crate::common::Result<Vec<Self>> {
        Self::repository()
            .find(Self::query().post_id(StringOp::Eq(post_id.to_string())))
            .await
            .map(|p| p.items)
            .map_err(crate::common::Error::from)
    }
}
