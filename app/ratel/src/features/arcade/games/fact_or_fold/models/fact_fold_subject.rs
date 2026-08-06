use crate::common::*;
use crate::features::arcade::games::fact_or_fold::types::{RevealSource, SubjectStatus, Verdict};

#[allow(unused_imports)]
use rmcp::schemars;

use postgres::ops::{EnumOp, StringOp};
use postgres::{Order, PostgresEntity, PostgresJson};
use uuid::Uuid;

/// jsonb newtype for the reveal-source list. serde treats the
/// single-field tuple newtype transparently → stored as a bare JSON
/// array. `Deref`/`DerefMut` expose the inner `Vec` so call sites read
/// it like a plain vector.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, PostgresJson)]
pub struct RevealSourceList(pub Vec<RevealSource>);

impl std::ops::Deref for RevealSourceList {
    type Target = Vec<RevealSource>;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}
impl std::ops::DerefMut for RevealSourceList {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}

/// jsonb newtype for the free-form category tag list (bare JSON array).
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, PostgresJson)]
pub struct CategoryTagList(pub Vec<String>);

impl std::ops::Deref for CategoryTagList {
    type Target = Vec<String>;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}
impl std::ops::DerefMut for CategoryTagList {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}

/// Single subject = single round's content (a news item players will
/// judge as Real or Fake).
///
/// Postgres migration: the DynamoDB shared-anchor-pk +
/// `FactFoldSubject(subject_id)` sort key becomes a surrogate `id` PK
/// plus a `unique(subject_id)` natural key. The old GSI3 `(status,
/// pick_at)` partition is now just two indexed columns queried
/// directly. `creator_pk` is a cross-feature actor reference stored as
/// the rendered `Partition` string (no FK).
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, PostgresEntity)]
#[postgres(table = "fact_fold_subjects")]
pub struct FactFoldSubject {
    pub id: Uuid,

    /// Business subject id (was the sort-key inner). UNIQUE.
    #[postgres(unique)]
    pub subject_id: String,

    pub created_at: i64,
    pub updated_at: i64,

    /// Operator who authored this subject (rendered `Partition` string).
    pub creator_pk: String,

    /// Was the GSI3 partition; now an indexed column so the per-status
    /// FIFO scans stay index-backed.
    #[postgres(index)]
    pub status: SubjectStatus,

    pub verdict: Verdict,

    pub headline_text: String,
    pub body_excerpt: String,

    /// Difficulty stars 1..=5.
    pub difficulty: i32,

    pub category_tags: CategoryTagList,

    pub source_label: String,

    /// Single private statement delivered to the insider.
    pub insider_statement: String,

    pub reveal_summary: String,

    pub reveal_sources: RevealSourceList,

    /// Millis since epoch; None for plain drafts.
    pub scheduled_at: Option<i64>,

    /// Materialized FIFO sort key — equal to
    /// `scheduled_at.unwrap_or(created_at)`. Was the GSI3 sort key;
    /// now an indexed column.
    #[postgres(index)]
    pub pick_at: i64,

    /// Millis since epoch when the subject's active window ends. `0`
    /// means "no expiry".
    pub expires_at: i64,
}

impl FactFoldSubject {
    /// Build a fresh draft from a creation request. Caller is responsible
    /// for validation and uniqueness check; this only assembles the row.
    pub fn new_draft(
        subject_id: String,
        creator_pk: Partition,
        headline_text: String,
        body_excerpt: String,
        verdict: Verdict,
        difficulty: i32,
        category_tags: Vec<String>,
        source_label: String,
        insider_statement: String,
        reveal_summary: String,
        reveal_sources: Vec<RevealSource>,
        scheduled_at: Option<i64>,
        expires_at: i64,
    ) -> Self {
        let now = crate::common::utils::time::get_now_timestamp_millis();
        let status = if scheduled_at.is_some() {
            SubjectStatus::Scheduled
        } else {
            SubjectStatus::Draft
        };
        let pick_at = scheduled_at.unwrap_or(now);
        Self {
            id: Uuid::now_v7(),
            subject_id,
            created_at: now,
            updated_at: now,
            creator_pk: creator_pk.to_string(),
            status,
            verdict,
            headline_text,
            body_excerpt,
            difficulty,
            category_tags: CategoryTagList(category_tags),
            source_label,
            insider_statement,
            reveal_summary,
            reveal_sources: RevealSourceList(reveal_sources),
            scheduled_at,
            pick_at,
            expires_at,
        }
    }

    /// True once a round has been started against this subject.
    pub fn is_locked(&self) -> bool {
        matches!(self.status, SubjectStatus::Live | SubjectStatus::Settled)
    }

    /// Point read by business subject id.
    pub async fn get_by_subject_id(subject_id: &str) -> crate::common::Result<Option<Self>> {
        Self::repository()
            .find_one(Self::query().subject_id(StringOp::Eq(subject_id.to_string())))
            .await
            .map_err(crate::common::Error::from)
    }

    /// All subjects in a given status, oldest `pick_at` first (FIFO).
    pub async fn list_by_status(
        status: SubjectStatus,
        limit: i64,
    ) -> crate::common::Result<Vec<Self>> {
        Ok(Self::repository()
            .find(
                Self::query()
                    .status(EnumOp::Eq(status))
                    .order_by(FactFoldSubjectColumn::PickAt, Order::Asc)
                    .limit(limit),
            )
            .await
            .map_err(crate::common::Error::from)?
            .items)
    }

    /// Paginated listing, newest `created_at` first. `status = Some`
    /// filters to that status; `None` with `exclude_deleted` skips
    /// soft-deleted rows.
    pub async fn list_page(
        status: Option<SubjectStatus>,
        exclude_deleted: bool,
        limit: i64,
        offset: i64,
    ) -> crate::common::Result<Vec<Self>> {
        let mut q = Self::query();
        match status {
            Some(s) => q = q.status(EnumOp::Eq(s)),
            None if exclude_deleted => q = q.status(EnumOp::Ne(SubjectStatus::Deleted)),
            None => {}
        }
        q = q
            .order_by(FactFoldSubjectColumn::CreatedAt, Order::Desc)
            .limit(limit)
            .offset(offset);
        Ok(Self::repository()
            .find(q)
            .await
            .map_err(crate::common::Error::from)?
            .items)
    }

    /// Create-if-not-exists on `subject_id` (fails if it already exists).
    pub async fn insert_new(&self) -> crate::common::Result<Self> {
        Self::repository()
            .insert(self)
            .await
            .map_err(crate::common::Error::from)
    }

    /// Natural-key upsert on `subject_id` (full-row overwrite).
    pub async fn save(&self) -> crate::common::Result<Self> {
        Self::repository()
            .upsert_on(&["subject_id"], self)
            .await
            .map_err(crate::common::Error::from)
    }
}
