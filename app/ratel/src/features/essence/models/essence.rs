use crate::features::essence::models::UserEssenceStats;
use crate::features::essence::types::*;
use crate::*;
use postgres::PostgresEntity;
use postgres::ops::{EnumOp, StringOp};
use uuid::Uuid;

/// One row per source a user has contributed to their Essence House.
///
/// The DynamoDB `(pk = USER#{uid}, sk = ESSENCE#{encoded})` layout is
/// collapsed onto a surrogate `id` PK plus a natural key
/// `unique(owner_pk, source_id)`:
/// - `owner_pk` holds the raw attribution partition string (`"USER#..."`
///   or `"TEAM#..."`) — team-authored content stays attributed to the team.
///   Kept as a plain `String` (cross-feature reference — no FK yet).
/// - `source_id` is the deterministic encoded id derived from the referenced
///   source's pk+sk, so re-indexing the same source upserts in place
///   (`upsert_on(["owner_pk","source_id"])`).
///
/// The three former GSIs (updated_at / word_count / title) become plain
/// indexed columns; ordering is done with `ORDER BY` in `list_for_user`.
#[cfg(feature = "server")]
#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq, postgres::PostgresEntity)]
#[postgres(table = "essences", unique(owner_pk, source_id))]
pub struct Essence {
    /// Surrogate primary key (minted `now_v7` on insert when nil).
    pub id: Uuid,

    /// Attribution partition string (`"USER#..."` / `"TEAM#..."`). Cross-
    /// feature reference — plain column, no `references=` FK.
    #[postgres(index)]
    pub owner_pk: String,

    /// Deterministic id encoding the referenced source's pk+sk. Together with
    /// `owner_pk` forms the natural upsert key and the wire `id`.
    pub source_id: String,

    pub source_kind: EssenceSourceKind,

    #[postgres(index)]
    pub title: String,

    pub source_path: String,

    /// Raw pk/sk strings of the referenced entity — stored as `String` so we
    /// can reference arbitrary source systems (Notion, future integrations)
    /// without forcing every foreign id into the Partition enum.
    pub source_pk: String,
    pub source_sk: String,

    /// Space this essence belongs to, if any (raw `SPACE#{uuid}` string).
    /// Nullable column.
    pub space_pk: Option<String>,

    #[postgres(index)]
    pub word_count: i64,

    pub created_at: i64,

    #[postgres(order, index)]
    pub updated_at: i64,
}

#[cfg(feature = "server")]
impl Essence {
    /// Build a deterministic Essence id from the referenced source's pk+sk.
    /// Replaces `#` with `_` so the encoded id has a single top-level `~`
    /// separator.
    fn encode_source_id(source_pk: &str, source_sk: &str) -> String {
        let pk = source_pk.replace('#', "_");
        let sk = source_sk.replace('#', "_");
        format!("{pk}~{sk}")
    }

    /// The deterministic `source_id` (natural key + wire id) for a source.
    pub fn source_id_for(source_pk: &Partition, source_sk: &EntityType) -> String {
        Self::encode_source_id(&source_pk.to_string(), &source_sk.to_string())
    }

    /// Construct (without persisting) an Essence row for the given source.
    pub fn new(
        owner_pk: Partition,
        source_pk: Partition,
        source_sk: EntityType,
        source_kind: EssenceSourceKind,
        title: String,
        source_path: String,
        word_count: i64,
        space_pk: Option<Partition>,
    ) -> Self {
        let now = chrono::Utc::now().timestamp();
        let source_pk_str = source_pk.to_string();
        let source_sk_str = source_sk.to_string();

        Self {
            id: Uuid::nil(),
            owner_pk: owner_pk.to_string(),
            source_id: Self::source_id_for(&source_pk, &source_sk),
            source_kind,
            title,
            source_path,
            source_pk: source_pk_str,
            source_sk: source_sk_str,
            space_pk: space_pk.map(|p| p.to_string()),
            word_count,
            created_at: now,
            updated_at: now,
        }
    }

    /// Fetch the row mirroring `source_id` under `owner_pk`, if any.
    pub async fn get_for_user(owner_pk: &Partition, source_id: &str) -> Result<Option<Self>> {
        Self::get_row(&owner_pk.to_string(), source_id).await
    }

    async fn get_row(owner_pk: &str, source_id: &str) -> Result<Option<Self>> {
        Self::repository()
            .find_one(
                Self::query()
                    .owner_pk(StringOp::Eq(owner_pk.to_string()))
                    .source_id(StringOp::Eq(source_id.to_string())),
            )
            .await
            .map_err(|e| {
                crate::error!("essence get_row failed: {e}");
                EssenceError::ReadFailed.into()
            })
    }

    /// Idempotent write — the `(owner_pk, source_id)` natural key means calling
    /// this twice for the same source updates the existing row rather than
    /// duplicating it. Preserves `created_at` from the existing row. Keeps the
    /// per-user counter row in sync via `bump_stats`.
    ///
    /// Named `put` rather than `upsert` because `PostgresEntity` already
    /// generates repository `upsert`/`upsert_on` methods.
    pub async fn put(&self) -> Result<()> {
        let mut row = self.clone();
        let existing = Self::get_row(&self.owner_pk, &self.source_id)
            .await
            .ok()
            .flatten();
        // When the row exists, only bump the word delta and skip source
        // counters. On first insert bump the global `+1` and the matching
        // per-kind `+1`.
        let (source_delta, words_delta, kind_delta_kind) = match &existing {
            Some(old) => {
                row.created_at = old.created_at;
                (0i64, row.word_count - old.word_count, None)
            }
            None => (1i64, row.word_count, Some(row.source_kind)),
        };
        Self::repository()
            .upsert_on(&["owner_pk", "source_id"], &row)
            .await
            .map_err(|e| {
                crate::error!("essence upsert failed: {e}");
                EssenceError::UpsertFailed
            })?;
        Self::bump_stats(&row.owner_pk, source_delta, words_delta, kind_delta_kind).await;
        Ok(())
    }

    /// Read-modify-write counter update. The DynamoDB atomic `ADD` is replaced
    /// with a get-default-then-`upsert_on(owner_pk)`; per the original design
    /// counter drift is tolerated (logged, never fails a write) and can be
    /// reconciled by the migrate endpoint.
    ///
    /// `kind_delta` is `Some(kind)` when the per-kind counter for that kind
    /// should be bumped by the same `source_delta`.
    async fn bump_stats(
        owner_pk: &str,
        source_delta: i64,
        words_delta: i64,
        kind_delta: Option<EssenceSourceKind>,
    ) {
        if source_delta == 0 && words_delta == 0 && kind_delta.is_none() {
            return;
        }
        let mut stats = match UserEssenceStats::get_or_default(owner_pk).await {
            Ok(s) => s,
            Err(e) => {
                crate::error!("essence stats bump read failed: {e}");
                return;
            }
        };
        stats.total_sources += source_delta;
        stats.total_words += words_delta;
        if let Some(kind) = kind_delta {
            match kind {
                EssenceSourceKind::Notion => stats.total_notion += source_delta,
                EssenceSourceKind::Post => stats.total_post += source_delta,
                EssenceSourceKind::PostComment | EssenceSourceKind::DiscussionComment => {
                    stats.total_comment += source_delta
                }
                EssenceSourceKind::Poll => stats.total_poll += source_delta,
                EssenceSourceKind::Quiz => stats.total_quiz += source_delta,
                EssenceSourceKind::FactFoldRationale => {
                    stats.total_fact_fold_rationale += source_delta
                }
            }
        }
        if let Err(e) = UserEssenceStats::repository()
            .upsert_on(&["owner_pk"], &stats)
            .await
        {
            crate::error!("essence stats bump write failed: {e}");
        }
    }

    /// Overwrite the stats row with an exact snapshot. Used by the migrate
    /// endpoint to reconcile drift.
    pub async fn replace_stats(owner_pk: &str, totals: UserEssenceStats) -> Result<()> {
        let mut row = totals;
        row.owner_pk = owner_pk.to_string();
        UserEssenceStats::repository()
            .upsert_on(&["owner_pk"], &row)
            .await
            .map_err(|e| {
                crate::error!("essence stats replace failed: {e}");
                EssenceError::UpsertFailed
            })?;
        Ok(())
    }

    /// Convenience wrapper: construct + upsert in one call.
    #[allow(clippy::too_many_arguments)]
    pub async fn upsert_for_source(
        owner_pk: Partition,
        source_pk: Partition,
        source_sk: EntityType,
        source_kind: EssenceSourceKind,
        title: String,
        source_path: String,
        word_count: i64,
        space_pk: Option<Partition>,
    ) -> Result<()> {
        let row = Self::new(
            owner_pk,
            source_pk,
            source_sk,
            source_kind,
            title,
            source_path,
            word_count,
            space_pk,
        );
        row.put().await
    }

    /// Remove the Essence row mirroring the given source, if any. Silently
    /// succeeds when no row exists.
    pub async fn delete_for_source(
        owner_pk: Partition,
        source_pk: &Partition,
        source_sk: &EntityType,
    ) -> Result<()> {
        let source_id = Self::source_id_for(source_pk, source_sk);
        Self::detach_by_source_id(&owner_pk, source_id).await
    }

    /// Shared delete path for both cascade and the user-facing
    /// `DELETE /api/essences/:id` endpoint. Captures the row's word count and
    /// kind before deleting so the counter decrement is accurate.
    pub async fn detach_by_source_id(owner_pk: &Partition, source_id: String) -> Result<()> {
        let Some(row) = Self::get_for_user(owner_pk, &source_id).await? else {
            return Ok(());
        };
        let words = row.word_count;
        let kind = row.source_kind;
        Self::repository().delete(row.id).await.map_err(|e| {
            crate::error!("essence cascade delete failed: {e}");
            EssenceError::DeleteFailed
        })?;
        Self::bump_stats(&owner_pk.to_string(), -1, -words, Some(kind)).await;
        Ok(())
    }

    /// Paginated, sorted, kind-filtered list of a user's Essence rows.
    /// `page` is 1-based. Kind filtering is done in SQL (no in-memory scan),
    /// so pagination stays correct at any data size.
    pub async fn list_for_user(
        owner_pk: &Partition,
        sort: EssenceSort,
        kind: KindFilter,
        page: i64,
        page_size: i64,
    ) -> Result<postgres::Page<Self>> {
        let mut q = Self::query().owner_pk(StringOp::Eq(owner_pk.to_string()));
        q = match kind {
            KindFilter::All => q,
            KindFilter::Notion => q.source_kind(EnumOp::Eq(EssenceSourceKind::Notion)),
            KindFilter::Post => q.source_kind(EnumOp::Eq(EssenceSourceKind::Post)),
            KindFilter::Poll => q.source_kind(EnumOp::Eq(EssenceSourceKind::Poll)),
            KindFilter::Quiz => q.source_kind(EnumOp::Eq(EssenceSourceKind::Quiz)),
            KindFilter::Comment => q.source_kind(EnumOp::In(vec![
                EssenceSourceKind::PostComment,
                EssenceSourceKind::DiscussionComment,
            ])),
        };
        q = match sort {
            EssenceSort::LastEditedDesc => {
                q.order_by(EssenceColumn::UpdatedAt, postgres::Order::Desc)
            }
            EssenceSort::WordCountDesc => {
                q.order_by(EssenceColumn::WordCount, postgres::Order::Desc)
            }
            EssenceSort::TitleAsc => q.order_by(EssenceColumn::Title, postgres::Order::Asc),
        };
        Self::repository()
            .find(q.page(page).page_size(page_size))
            .await
            .map_err(|e| {
                crate::error!("essence list failed: {e}");
                EssenceError::ReadFailed.into()
            })
    }

    /// Every Essence row, unpaginated — used only by the admin stats rebuild.
    pub async fn find_all_rows() -> Result<Vec<Self>> {
        Self::repository()
            .find(Self::query())
            .await
            .map(|p| p.items)
            .map_err(|e| {
                crate::error!("essence scan-all failed: {e}");
                EssenceError::ReadFailed.into()
            })
    }
}

#[cfg(feature = "server")]
impl From<Essence> for EssenceResponse {
    fn from(e: Essence) -> Self {
        Self {
            id: e.source_id,
            source_kind: e.source_kind,
            title: e.title,
            source_path: e.source_path,
            source_pk: e.source_pk,
            source_sk: e.source_sk,
            space_pk: e.space_pk,
            word_count: e.word_count,
            updated_at: e.updated_at,
        }
    }
}
