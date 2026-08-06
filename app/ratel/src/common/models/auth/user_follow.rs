//! Follow graph edges.
//!
//! Postgres migration: the DynamoDB single-table design stored **two rows** per
//! follow relationship — a "follower" row keyed under the target
//! (`pk = target`, `sk = Follower(follower_id)`) so a target's followers list is
//! a single-partition query, and a "following" row keyed under the follower
//! (`pk = follower`, `sk = Following(target_id)`). That exact two-row shape is
//! preserved (behaviour-preserving — counts and listings are unchanged): each
//! logical DynamoDB row becomes one Postgres row discriminated by a
//! [`FollowRelation`] column, with the old `(pk, sk)` natural key becoming
//! `unique(owner_pk, relation, other_pk)`.
//!
//! `owner_pk` / `other_pk` / `user_pk` / `target_user_pk` all hold the
//! `Partition`-string form (`"USER#.."` / `"TEAM#.."`) — cross-feature
//! references, plain columns, no FK.
#![cfg(feature = "server")]

use crate::common::utils::time::get_now_timestamp_millis;
use crate::common::*;
use postgres::PostgresEntity;
use postgres::ops::{EnumOp, StringOp};
use uuid::Uuid;

/// Which side of the follow edge a row denormalizes. Mirrors the old `sk`
/// variant (`EntityType::Follower` / `EntityType::Following`).
#[derive(
    Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default, postgres::PostgresEnum,
)]
#[postgres(type = "user_follow_relation")]
#[serde(rename_all = "snake_case")]
pub enum FollowRelation {
    /// Row listed under the **target** — "who follows this user".
    #[default]
    Follower,
    /// Row listed under the **follower** — "who this user follows".
    Following,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, PostgresEntity)]
#[postgres(table = "user_follows", unique(owner_pk, relation, other_pk))]
pub struct UserFollow {
    /// Surrogate primary key (minted `now_v7` on insert when nil).
    pub id: Uuid,

    /// List owner — the DynamoDB `pk`. For a `Follower` row this is the target
    /// user; for a `Following` row it is the follower. Indexed so a user's
    /// followers/followings list is a single indexed query.
    #[postgres(index)]
    pub owner_pk: String,

    pub relation: FollowRelation,

    /// The other side of the edge — the DynamoDB `sk` payload. For a `Follower`
    /// row this is the follower id; for a `Following` row it is the target id.
    pub other_pk: String,

    #[postgres(order)]
    pub created_at: i64,

    /// Follower's partition string. Cross-feature reference — plain column.
    #[postgres(index)]
    pub user_pk: String,
    /// Target's partition string. Cross-feature reference — plain column.
    pub target_user_pk: String,

    #[serde(default)]
    pub space_id: Option<String>,
    #[serde(default)]
    pub action_id: Option<String>,
    #[serde(default)]
    pub display_name: Option<String>,
    #[serde(default)]
    pub profile_url: Option<String>,
}

impl UserFollow {
    pub fn new_follow_records(follower_pk: Partition, target_pk: Partition) -> (Self, Self) {
        Self::new_follow_records_with_space(follower_pk, target_pk, None, None, None, None)
    }

    pub fn new_follow_records_with_space(
        follower_pk: Partition,
        target_pk: Partition,
        space_id: Option<String>,
        action_id: Option<String>,
        display_name: Option<String>,
        profile_url: Option<String>,
    ) -> (Self, Self) {
        let now = get_now_timestamp_millis();
        let follower_id = follower_pk.to_string();
        let target_id = target_pk.to_string();

        let follower_record = UserFollow {
            id: Uuid::now_v7(),
            owner_pk: target_id.clone(),
            relation: FollowRelation::Follower,
            other_pk: follower_id.clone(),
            created_at: now,
            user_pk: follower_id.clone(),
            target_user_pk: target_id.clone(),
            space_id: space_id.clone(),
            action_id: action_id.clone(),
            display_name: display_name.clone(),
            profile_url: profile_url.clone(),
        };

        let following_record = UserFollow {
            id: Uuid::now_v7(),
            owner_pk: follower_id.clone(),
            relation: FollowRelation::Following,
            other_pk: target_id.clone(),
            created_at: now,
            user_pk: follower_id,
            target_user_pk: target_id,
            space_id,
            action_id,
            display_name,
            profile_url,
        };

        (follower_record, following_record)
    }

    /// The `Follower` row for `follower_pk` under `target_pk`, if it exists
    /// (replaces the old `get(follower_keys(..))`).
    pub async fn find_follower(
        target_pk: &Partition,
        follower_pk: &Partition,
    ) -> Result<Option<Self>> {
        Self::find_edge(
            &target_pk.to_string(),
            FollowRelation::Follower,
            &follower_pk.to_string(),
        )
        .await
    }

    /// The `Following` row for `target_pk` under `follower_pk`, if it exists
    /// (replaces the old `get(following_keys(..))`).
    pub async fn find_following(
        follower_pk: &Partition,
        target_pk: &Partition,
    ) -> Result<Option<Self>> {
        Self::find_edge(
            &follower_pk.to_string(),
            FollowRelation::Following,
            &target_pk.to_string(),
        )
        .await
    }

    async fn find_edge(
        owner_pk: &str,
        relation: FollowRelation,
        other_pk: &str,
    ) -> Result<Option<Self>> {
        Self::repository()
            .find_one(
                Self::query()
                    .owner_pk(StringOp::Eq(owner_pk.to_string()))
                    .relation(EnumOp::Eq(relation))
                    .other_pk(StringOp::Eq(other_pk.to_string())),
            )
            .await
            .map_err(Error::from)
    }

    /// Idempotent delete of a single edge row by its natural key.
    pub async fn delete_edge(
        owner_pk: &Partition,
        relation: FollowRelation,
        other_pk: &Partition,
    ) -> Result<()> {
        if let Some(row) =
            Self::find_edge(&owner_pk.to_string(), relation, &other_pk.to_string()).await?
        {
            Self::repository().delete(row.id).await.map_err(Error::from)?;
        }
        Ok(())
    }

    /// One page of a user's follower rows (relation = `Follower`), newest first.
    pub async fn list_followers_page(
        owner_pk: &Partition,
        page: i64,
        page_size: i64,
    ) -> Result<postgres::Page<Self>> {
        Self::list_page(owner_pk, FollowRelation::Follower, page, page_size).await
    }

    /// One page of a user's following rows (relation = `Following`), newest first.
    pub async fn list_followings_page(
        owner_pk: &Partition,
        page: i64,
        page_size: i64,
    ) -> Result<postgres::Page<Self>> {
        Self::list_page(owner_pk, FollowRelation::Following, page, page_size).await
    }

    async fn list_page(
        owner_pk: &Partition,
        relation: FollowRelation,
        page: i64,
        page_size: i64,
    ) -> Result<postgres::Page<Self>> {
        Self::repository()
            .find(
                Self::query()
                    .owner_pk(StringOp::Eq(owner_pk.to_string()))
                    .relation(EnumOp::Eq(relation))
                    .order_by(UserFollowColumn::CreatedAt, postgres::Order::Desc)
                    .page(page)
                    .page_size(page_size),
            )
            .await
            .map_err(Error::from)
    }

    /// Which of `targets` the `follower_pk` user follows — the `Following` rows
    /// under `follower_pk` whose `other_pk` is in `targets` (replaces the old
    /// `batch_get(following_keys(..))`).
    pub async fn following_targets_in(
        follower_pk: &Partition,
        targets: &[Partition],
    ) -> Result<Vec<Self>> {
        if targets.is_empty() {
            return Ok(vec![]);
        }
        let other_pks: Vec<String> = targets.iter().map(|p| p.to_string()).collect();
        Ok(Self::repository()
            .find(
                Self::query()
                    .owner_pk(StringOp::Eq(follower_pk.to_string()))
                    .relation(EnumOp::Eq(FollowRelation::Following))
                    .other_pk(StringOp::In(other_pks)),
            )
            .await
            .map_err(Error::from)?
            .items)
    }
}
