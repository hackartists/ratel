use crate::features::spaces::pages::actions::actions::discussion::*;
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
use postgres::ops::StringOp;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

/// Why a user is reporting a comment. Shown in the report dialog (translated in
/// the UI) and surfaced to admins in the moderation queue.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "server", derive(postgres::PostgresEnum))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub enum ReportReason {
    Spam,
    Harassment,
    HateSpeech,
    Violence,
    SexualContent,
    #[default]
    Other,
}

/// One row per (comment, reporter).
///
/// Postgres migration: the DynamoDB identity was the post `Partition` plus
/// `sk = SpacePostCommentReport#{comment_id}#{reporter_id}` (the composite sk
/// was what deduped double-reports), with a `find_by_author` GSI listing every
/// report against one author. It becomes a surrogate `id` PK, a
/// `UNIQUE(post_id, comment_key, reporter_pk)` doing the dedupe, and an indexed
/// `author_pk` replacing the GSI.
#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "server", derive(PostgresEntity))]
#[cfg_attr(
    feature = "server",
    postgres(
        table = "space_post_comment_reports",
        unique(post_id, comment_key, reporter_pk)
    )
)]
pub struct SpacePostCommentReport {
    #[serde(default)]
    pub id: uuid::Uuid,

    /// Owning discussion post id (the old `pk`'s inner id).
    #[cfg_attr(feature = "server", postgres(index))]
    pub post_id: String,

    /// Stable comment key — the leaf id for a top-level comment,
    /// `{parent}#{reply}` for a reply. Mirrors `SpacePostComment::like_key()`.
    pub comment_key: String,

    /// Reported comment's author (`USER#…`) — indexed so admins can pull every
    /// report filed against one user.
    #[cfg_attr(feature = "server", postgres(index))]
    pub author_pk: String,

    pub reporter_pk: String,

    #[serde(default)]
    pub reason: ReportReason,
    #[serde(default)]
    pub detail: String,

    #[serde(default)]
    pub created_at: i64,
}

#[cfg(feature = "server")]
impl SpacePostCommentReport {
    pub fn new(
        post_id: String,
        comment_key: String,
        author_pk: String,
        reporter_pk: &Partition,
        reason: ReportReason,
        detail: String,
    ) -> Self {
        use crate::common::utils::time::get_now_timestamp;
        Self {
            id: uuid::Uuid::now_v7(),
            post_id,
            comment_key,
            author_pk,
            reporter_pk: reporter_pk.to_string(),
            reason,
            detail,
            created_at: get_now_timestamp(),
        }
    }

    /// Whether this reporter already reported this comment (dedupe).
    pub async fn already_reported(
        post_id: &str,
        comment_key: &str,
        reporter_pk: &Partition,
    ) -> crate::common::Result<bool> {
        Self::repository()
            .find_one(
                Self::query()
                    .post_id(StringOp::Eq(post_id.to_string()))
                    .comment_key(StringOp::Eq(comment_key.to_string()))
                    .reporter_pk(StringOp::Eq(reporter_pk.to_string())),
            )
            .await
            .map(|r| r.is_some())
            .map_err(crate::common::Error::from)
    }

    /// DISTINCT reporters of one comment — drives the auto-hide threshold.
    pub async fn count_for_comment(post_id: &str, comment_key: &str) -> crate::common::Result<i64> {
        Self::repository()
            .count(
                &Self::query()
                    .post_id(StringOp::Eq(post_id.to_string()))
                    .comment_key(StringOp::Eq(comment_key.to_string())),
            )
            .await
            .map_err(crate::common::Error::from)
    }

    /// Every report filed against one author, newest first (paged).
    pub async fn list_by_author(
        author_pk: &Partition,
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
                    .author_pk(StringOp::Eq(author_pk.to_string()))
                    .order_by(SpacePostCommentReportColumn::CreatedAt, Order::Desc)
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

    /// Which of `comment_keys` the viewer has already reported — lets the UI
    /// hide the "Report" action after the first report.
    pub async fn reported_keys(
        post_id: &str,
        reporter_pk: &Partition,
        comment_keys: Vec<String>,
    ) -> crate::common::Result<std::collections::HashSet<String>> {
        if comment_keys.is_empty() {
            return Ok(Default::default());
        }
        Ok(Self::repository()
            .find(
                Self::query()
                    .post_id(StringOp::Eq(post_id.to_string()))
                    .reporter_pk(StringOp::Eq(reporter_pk.to_string()))
                    .comment_key(StringOp::In(comment_keys))
                    .page(1)
                    .page_size(500),
            )
            .await
            .map_err(crate::common::Error::from)?
            .items
            .into_iter()
            .map(|r| r.comment_key)
            .collect())
    }
}
