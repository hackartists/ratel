use crate::features::spaces::pages::actions::actions::follow::*;
#[cfg(feature = "server")]
use crate::common::utils::time::get_now_timestamp_millis;
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
use postgres::ops::StringOp;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;
#[cfg(feature = "server")]
use uuid::Uuid;

/// One follow-target row per (space, target user).
///
/// Postgres migration: the DynamoDB identity was `pk = SpacePartition` +
/// `sk = SpaceSubscriptionUser#{user_pk}`. It becomes a surrogate `id` PK plus
/// `(space_id, user_pk)` natural key. `space_id` (spaces) and `user_pk`
/// (users/teams, full `Partition` string) are cross-feature refs — plain
/// columns, **no FK**. Server-only (never returned raw to the client).
#[cfg(feature = "server")]
#[derive(Debug, Clone, Serialize, Deserialize, Default, PostgresEntity)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[postgres(table = "space_follow_users", unique(space_id, user_pk))]
pub struct SpaceFollowUser {
    pub id: Uuid,

    #[postgres(index)]
    pub space_id: String,
    /// Target actor as full `Partition` string (`USER#…` / `TEAM#…`).
    pub user_pk: String,

    #[postgres(order)]
    pub created_at: i64,
    pub updated_at: i64,

    #[serde(default)]
    pub display_name: String,
    #[serde(default)]
    pub profile_url: String,
    #[serde(default)]
    pub username: String,
    #[serde(default)]
    pub user_type: FollowUserType,
    #[serde(default)]
    pub description: String,
}

#[cfg(feature = "server")]
impl SpaceFollowUser {
    pub fn new(
        space_pk: SpacePartition,
        user_pk: Partition,
        display_name: String,
        profile_url: String,
        username: String,
        user_type: UserType,
        description: String,
    ) -> Self {
        let now = get_now_timestamp_millis();

        Self {
            id: Uuid::now_v7(),
            space_id: space_pk.0,
            user_pk: user_pk.to_string(),
            created_at: now,
            updated_at: now,
            display_name,
            profile_url,
            username,
            user_type: FollowUserType(user_type),
            description,
        }
    }

    /// The target actor as a `Partition` (reconstructed from the stored string).
    pub fn user_partition(&self) -> Partition {
        use std::str::FromStr;
        Partition::from_str(&self.user_pk).unwrap_or(Partition::None)
    }

    /// The single follow-target row for `(space, user)`, if present.
    pub async fn get_one(
        space_pk: &SpacePartition,
        user_pk: &Partition,
    ) -> crate::common::Result<Option<Self>> {
        Self::repository()
            .find_one(
                Self::query()
                    .space_id(StringOp::Eq(space_pk.0.clone()))
                    .user_pk(StringOp::Eq(user_pk.to_string())),
            )
            .await
            .map_err(crate::common::Error::from)
    }

    /// One page of follow-target rows for a space, oldest first. `bookmark`
    /// carries a 1-based page number (the DynamoDB opaque cursor is gone); the
    /// returned bookmark is the next page number when more rows remain.
    pub async fn list_by_space(
        space_pk: &SpacePartition,
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
                    .space_id(StringOp::Eq(space_pk.0.clone()))
                    .order_by(SpaceFollowUserColumn::CreatedAt, Order::Asc)
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

    /// Natural-key upsert on `(space_id, user_pk)`.
    pub async fn save(&self) -> crate::common::Result<Self> {
        Self::repository()
            .upsert_on(&["space_id", "user_pk"], self)
            .await
            .map_err(crate::common::Error::from)
    }
}
