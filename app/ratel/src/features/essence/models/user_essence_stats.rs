use crate::features::essence::types::*;
use crate::*;
use postgres::PostgresEntity;
use postgres::ops::StringOp;
use uuid::Uuid;

/// Per-user aggregate counters for the Essence list. Maintained by
/// read-modify-write from `Essence::put` and the delete paths, so the hero
/// card can show accurate totals in one roundtrip.
///
/// Singleton per user — `unique(owner_pk)`. `owner_pk` is the raw attribution
/// partition string (`"USER#..."` / `"TEAM#..."`), a cross-feature reference
/// stored as a plain column (no FK yet).
///
/// Per-kind fields mirror the client `KindFilter` chips. `total_comment` is
/// the aggregate of `PostComment` + `DiscussionComment`.
#[cfg(feature = "server")]
#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq, postgres::PostgresEntity)]
#[postgres(table = "user_essence_stats", unique(owner_pk))]
pub struct UserEssenceStats {
    pub id: Uuid,

    #[postgres(index)]
    pub owner_pk: String,

    #[serde(default)]
    pub total_sources: i64,
    #[serde(default)]
    pub total_words: i64,

    #[serde(default)]
    pub total_notion: i64,
    #[serde(default)]
    pub total_post: i64,
    #[serde(default)]
    pub total_comment: i64,
    #[serde(default)]
    pub total_poll: i64,
    #[serde(default)]
    pub total_quiz: i64,
    /// Count of Fact-or-Fold rationales registered to Essence.
    #[serde(default)]
    pub total_fact_fold_rationale: i64,
}

#[cfg(feature = "server")]
impl UserEssenceStats {
    /// Fetch the counter row, returning zeros (with `owner_pk` set) when the
    /// user has never had any Essence rows.
    pub async fn get_or_default(owner_pk: &str) -> Result<Self> {
        match Self::repository()
            .find_one(Self::query().owner_pk(StringOp::Eq(owner_pk.to_string())))
            .await
        {
            Ok(Some(row)) => Ok(row),
            Ok(None) => Ok(Self {
                owner_pk: owner_pk.to_string(),
                ..Default::default()
            }),
            Err(e) => {
                crate::error!("essence stats read failed: {e}");
                Err(EssenceError::ReadFailed.into())
            }
        }
    }
}
