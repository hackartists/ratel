use crate::features::activity::*;
use postgres::PostgresEntity;
use postgres::ops::StringOp;
use uuid::Uuid;

/// Aggregated per-(space, author) score. One row per participant per space.
///
/// Postgres migration: the DynamoDB identity was
/// `pk = (SpacePartition, AuthorPartition)` + `sk = SPACE_SCORE`. That collapses
/// to the natural key `(space_id, author_pk)` (composite UNIQUE) on a surrogate
/// `id` PK. The `find_by_space` / `find_by_space_rank` GSIs become an ordered
/// query on the `space_id` index (`ORDER BY total_score DESC`).
///
/// `space_id` (spaces) and `author_pk` (users/teams) are cross-feature
/// references — plain columns, **no FK** for now.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, PostgresEntity)]
#[postgres(table = "space_scores", unique(space_id, author_pk))]
pub struct SpaceScore {
    pub id: Uuid,

    /// Cross-feature reference to the space (bare id).
    #[postgres(index)]
    pub space_id: String,
    /// Actor as full `Partition` string (`USER#…` / `TEAM#…`).
    pub author_pk: String,

    pub total_score: i64,
    #[serde(default)]
    pub rank_total_score: i64,

    pub user_name: String,
    pub user_avatar: String,

    pub poll_score: i64,
    pub quiz_score: i64,
    pub follow_score: i64,
    pub discussion_score: i64,

    #[postgres(order)]
    pub updated_at: i64,
}

#[cfg(feature = "server")]
impl SpaceScore {
    pub fn new(
        space_id: SpacePartition,
        author: AuthorPartition,
        user_name: String,
        user_avatar: String,
    ) -> Self {
        let now = crate::common::utils::time::get_now_timestamp_millis();

        Self {
            id: Uuid::now_v7(),
            space_id: space_id.0,
            author_pk: author.to_string(),
            total_score: 0,
            rank_total_score: 0,
            user_name,
            user_avatar,
            poll_score: 0,
            quiz_score: 0,
            follow_score: 0,
            discussion_score: 0,
            updated_at: now,
        }
    }

    /// The single score row for `(space, author)`, if the participant has any
    /// recorded activity yet.
    pub async fn get_for(
        space_id: &SpacePartition,
        author: &AuthorPartition,
    ) -> crate::common::Result<Option<Self>> {
        Self::repository()
            .find_one(
                Self::query()
                    .space_id(StringOp::Eq(space_id.0.clone()))
                    .author_pk(StringOp::Eq(author.to_string())),
            )
            .await
            .map_err(super::map_db_err)
    }

    /// Every score row for a space, highest `total_score` first. `page` is
    /// 1-based; `page_size` bounds the result. Returns the `postgres::Page`
    /// so callers can derive the next bookmark from `total_pages`.
    ///
    /// Ordering mirrors the original DynamoDB GSI2 composite sort key under
    /// `scan_index_forward(false)`: `total_score DESC`, then `updated_at DESC`,
    /// then `author_pk DESC` (the `user_pk` tie-breaker). Restoring the
    /// secondary keys keeps ties in the exact same order the DynamoDB index
    /// returned them.
    pub async fn find_by_space_rank(
        space_id: &SpacePartition,
        page: i64,
        page_size: i64,
    ) -> crate::common::Result<postgres::Page<Self>> {
        use postgres::Order;
        Self::repository()
            .find(
                Self::query()
                    .space_id(StringOp::Eq(space_id.0.clone()))
                    .order_by(SpaceScoreColumn::TotalScore, Order::Desc)
                    .order_by(SpaceScoreColumn::UpdatedAt, Order::Desc)
                    .order_by(SpaceScoreColumn::AuthorPk, Order::Desc)
                    .page_size(page_size)
                    .page(page),
            )
            .await
            .map_err(super::map_db_err)
    }

    /// Every score row for a space, unpaginated, in the same
    /// `total_score DESC, updated_at DESC, author_pk DESC` order as the
    /// DynamoDB GSI2 index (`scan_index_forward(false)`). Mirrors the
    /// original `find_by_space_rank(cli, pk, opt_all())` scan used to derive a
    /// participant's absolute rank by list position.
    pub async fn find_all_by_space_ranked(
        space_id: &SpacePartition,
    ) -> crate::common::Result<Vec<Self>> {
        use postgres::Order;
        Self::repository()
            .find(
                Self::query()
                    .space_id(StringOp::Eq(space_id.0.clone()))
                    .order_by(SpaceScoreColumn::TotalScore, Order::Desc)
                    .order_by(SpaceScoreColumn::UpdatedAt, Order::Desc)
                    .order_by(SpaceScoreColumn::AuthorPk, Order::Desc),
            )
            .await
            .map(|p| p.items)
            .map_err(super::map_db_err)
    }

    /// Natural-key upsert on `(space_id, author_pk)`, preserving the surrogate
    /// `id`. Used by score aggregation (read-modify-write).
    pub async fn save(&self) -> crate::common::Result<Self> {
        Self::repository()
            .upsert_on(&["space_id", "author_pk"], self)
            .await
            .map_err(super::map_db_err)
    }
}
