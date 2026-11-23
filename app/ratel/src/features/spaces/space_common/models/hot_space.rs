use crate::common::*;
#[cfg(feature = "server")]
use postgres::PostgresEntity;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "server", derive(postgres::PostgresEnum))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub enum HotSpaceHeat {
    Blazing,
    Trending,
    Rising,
}

impl Default for HotSpaceHeat {
    fn default() -> Self {
        HotSpaceHeat::Rising
    }
}

impl HotSpaceHeat {
    pub fn from_participants(participants: i64) -> Self {
        if participants >= 5_000 {
            HotSpaceHeat::Blazing
        } else if participants >= 500 {
            HotSpaceHeat::Trending
        } else {
            HotSpaceHeat::Rising
        }
    }
}

/// Constant value for the HotSpace ranking partition key. Every HotSpace row
/// shares this so a single ordered query returns the global ranked stream. If
/// the partition ever grows hot enough to throttle, shard by appending a hash
/// bucket here (e.g. `ALL#0`..`ALL#15`) and fan-out reads.
pub const HOT_SPACE_RANK_PK: &str = "ALL";

/// Denormalized snapshot of a Space's Hot ranking.
///
/// Postgres migration: the DynamoDB identity was `pk = Space(space_id)` +
/// `sk = HotSpace` (one row per space). It becomes a surrogate `id` PK with a
/// plain `space_id` column (unique — the per-space singleton invariant). The
/// GSI1 global ranked stream (`pk = HSR#ALL`, `sk = WindowedRankKey`) becomes
/// an ordered query on the `rank_key` string column (the `WindowedRankKey`
/// Display form, ascending = best-first). `rank_pk` is retained as a constant
/// column so future sharding stays possible.
///
/// `space_id` and `post_id` are cross-feature references (spaces / posts) —
/// plain columns, **no FK** for now. The fanout in `services::space_fanout`
/// is the only writer.
#[cfg(feature = "server")]
#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq, postgres::PostgresEntity)]
#[postgres(table = "hot_spaces", unique(space_id))]
pub struct HotSpace {
    pub id: uuid::Uuid,

    /// Cross-feature reference to the space (bare id).
    #[postgres(index)]
    pub space_id: String,

    pub created_at: i64,
    pub updated_at: i64,

    /// Always `HOT_SPACE_RANK_PK`. Constant so all rows share one ranked
    /// stream sortable by `rank_key`.
    #[postgres(index)]
    pub rank_pk: String,

    /// `WindowedRankKey` Display: `W{window:04}{score:020}` (base-62,
    /// descending by quality). Ascending order is best-first within each window.
    #[postgres(order, index(version = 1))]
    pub rank_key: String,

    /// Cross-feature reference to the space's post/feed (bare id).
    pub post_id: String,
    pub title: String,
    pub description: String,
    pub logo: String,
    pub author_display_name: String,
    pub participants: i64,
    pub rewards: i64,
    pub poll_count: i64,
    pub discussion_count: i64,
    pub quiz_count: i64,
    pub follow_count: i64,
    pub total_actions: i64,
    pub heat: HotSpaceHeat,
    pub space_created_at: i64,
}

#[cfg(feature = "server")]
impl HotSpace {
    /// Global ranked stream, best-first (`rank_key` ascending), page-paginated.
    /// Returns the page's items (at most `page_size`) and `has_next`.
    pub async fn find_ranked(page: i64, page_size: i64) -> postgres::Result<(Vec<Self>, bool)> {
        let page = page.max(1);
        let mut items = Self::repository()
            .find_rows(
                Self::query()
                    .order_by(HotSpaceColumn::RankKey, postgres::Order::Asc)
                    .limit(page_size + 1)
                    .offset((page - 1) * page_size),
            )
            .await?;
        let has_next = items.len() as i64 > page_size;
        items.truncate(page_size.max(0) as usize);
        Ok((items, has_next))
    }

    /// Delete this space's hot row (best-effort; missing row is not an error).
    pub async fn delete_for_space(space_id: &str) -> postgres::Result<()> {
        use postgres::ops::StringOp;
        if let Some(existing) = Self::repository()
            .find_one(Self::query().space_id(StringOp::Eq(space_id.to_string())))
            .await?
        {
            match Self::delete_by_id(existing.id).await {
                Ok(_) | Err(postgres::Error::NotFound) => {}
                Err(e) => return Err(e),
            }
        }
        Ok(())
    }
}
