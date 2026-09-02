//! User-triggered text-analysis result for one discussion under one
//! report. History is preserved — every `확인` press creates a new row
//! (UUIDv7 `id` keeps them naturally time-ordered).
//!
//! Postgres migration: surrogate `id` PK = the request UUIDv7 (so
//! `id.to_string()` is the same `request_id` clients pass on the wire).
//! `space_pk` / `report_id` / `discussion_id` are indexed plain-string
//! references; result lists are opaque jsonb; `status` a native PG enum.

use crate::features::spaces::pages::apps::apps::analyzes::*;
use uuid::Uuid;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[cfg(feature = "server")]
use postgres::PostgresEntity;

/// jsonb wrapper for LDA topic rows.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[cfg_attr(
    feature = "server",
    derive(postgres::PostgresJson)
)]
pub struct TopicRows(pub Vec<TopicRow>);
impl std::ops::Deref for TopicRows {
    type Target = Vec<TopicRow>;
    fn deref(&self) -> &Vec<TopicRow> {
        &self.0
    }
}

/// jsonb wrapper for TF-IDF term scores.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[cfg_attr(
    feature = "server",
    derive(postgres::PostgresJson)
)]
pub struct TermScores(pub Vec<TermScore>);
impl std::ops::Deref for TermScores {
    type Target = Vec<TermScore>;
    fn deref(&self) -> &Vec<TermScore> {
        &self.0
    }
}

/// jsonb wrapper for text-network nodes.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[cfg_attr(
    feature = "server",
    derive(postgres::PostgresJson)
)]
pub struct NetworkNodes(pub Vec<NetworkNode>);
impl std::ops::Deref for NetworkNodes {
    type Target = Vec<NetworkNode>;
    fn deref(&self) -> &Vec<NetworkNode> {
        &self.0
    }
}

/// jsonb wrapper for text-network edges.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[cfg_attr(
    feature = "server",
    derive(postgres::PostgresJson)
)]
pub struct NetworkEdges(pub Vec<NetworkEdge>);
impl std::ops::Deref for NetworkEdges {
    type Target = Vec<NetworkEdge>;
    fn deref(&self) -> &Vec<NetworkEdge> {
        &self.0
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
// Serialize through `SpaceAnalyzeDiscussionResultWire` so the shipped mobile
// build still finds the legacy `pk`/`sk` keys. See that type.
#[serde(into = "SpaceAnalyzeDiscussionResultWire")]
#[cfg_attr(
    feature = "server",
    derive(PostgresEntity)
)]
#[cfg_attr(
    feature = "server",
    postgres(table = "space_analyze_discussion_results")
)]
pub struct SpaceAnalyzeDiscussionResult {
    pub id: Uuid,

    #[cfg_attr(feature = "server", postgres(index))]
    pub space_pk: String,

    #[cfg_attr(feature = "server", postgres(order))]
    pub created_at: i64,
    pub updated_at: i64,

    #[serde(default)]
    pub status: AnalyzeReportStatus,

    #[cfg_attr(feature = "server", postgres(index))]
    #[serde(default)]
    pub report_id: String,
    #[cfg_attr(feature = "server", postgres(index))]
    #[serde(default)]
    pub discussion_id: String,
    /// UUIDv7 string — mirrors `id`, surfaced for direct wire access.
    #[serde(default)]
    pub request_id: String,

    #[serde(default)]
    pub params: DiscussionAnalysisParams,

    #[serde(default)]
    pub analyzed_comment_count: i64,

    #[serde(default)]
    pub topics: TopicRows,
    #[serde(default)]
    pub tfidf_terms: TermScores,
    #[serde(default)]
    pub network_nodes: NetworkNodes,
    #[serde(default)]
    pub network_edges: NetworkEdges,
}

#[cfg(feature = "server")]
impl SpaceAnalyzeDiscussionResult {
    /// Builds a fresh "queued" row from a discussion analyse request.
    pub fn new(
        space_pk: Partition,
        report_id: String,
        discussion_id: String,
        params: DiscussionAnalysisParams,
    ) -> Self {
        use crate::common::utils::time::get_now_timestamp_millis;

        let now = get_now_timestamp_millis();
        let id = Uuid::now_v7();

        Self {
            id,
            space_pk: space_pk.to_string(),
            created_at: now,
            updated_at: now,
            status: AnalyzeReportStatus::InProgress,
            report_id,
            discussion_id,
            request_id: id.to_string(),
            params,
            analyzed_comment_count: 0,
            topics: TopicRows(Vec::new()),
            tfidf_terms: TermScores(Vec::new()),
            network_nodes: NetworkNodes(Vec::new()),
            network_edges: NetworkEdges(Vec::new()),
        }
    }

    /// Reconstruct the owning space `Partition` from `space_pk`.
    pub fn space_partition(&self) -> Partition {
        use std::str::FromStr;
        Partition::from_str(&self.space_pk).unwrap_or(Partition::Space(self.space_pk.clone()))
    }

    /// History rows for one (report, discussion), newest first. `bookmark`
    /// is a decimal 1-based page number; returned bookmark is the next
    /// page number or `None` on the last page.
    pub async fn list_history(
        space_pk: &Partition,
        report_id: &str,
        discussion_id: &str,
        bookmark: Option<String>,
        page_size: i64,
    ) -> crate::common::Result<(Vec<Self>, Option<String>)> {
        use postgres::Order;
        use postgres::ops::StringOp;

        let page: i64 = bookmark
            .as_deref()
            .and_then(|s| s.parse().ok())
            .unwrap_or(1)
            .max(1);

        let p = Self::repository()
            .find(
                Self::query()
                    .space_pk(StringOp::Eq(space_pk.to_string()))
                    .report_id(StringOp::Eq(report_id.to_string()))
                    .discussion_id(StringOp::Eq(discussion_id.to_string()))
                    .order_by(SpaceAnalyzeDiscussionResultColumn::Id, Order::Desc)
                    .page(page)
                    .page_size(page_size),
            )
            .await?;

        let next = if page < p.total_pages {
            Some((page + 1).to_string())
        } else {
            None
        };

        Ok((p.items, next))
    }
}

/// Wire form of [`SpaceAnalyzeDiscussionResult`] — identical plus the legacy
/// `pk`/`sk` keys.
///
/// Same reason as `UserWire`. This model is returned raw inside
/// `ListResponse<SpaceAnalyzeDiscussionResult>` by the analyze report detail
/// screen, so without these keys that screen dies on open for the shipped
/// mobile build.
///
/// The DynamoDB identity was `pk = space_pk` plus
/// `sk = SpaceAnalyzeDiscussionResult(report_id, "{discussion_id}#{request_id}")`
/// — the second slot packs two ids because the variant takes at most two
/// fields. `space_pk` still holds the `"SPACE#…"` string, so `pk` is parsed
/// back from it.
///
/// The `TopicRows`/`TermScores`/`NetworkNodes`/`NetworkEdges` wrappers need no
/// bridging: serde renders a tuple newtype as its inner value, so their JSON is
/// the same array the old `Vec<_>` fields produced.
// No `JsonSchema`: the jsonb wrapper types it embeds do not implement it.
#[derive(Serialize)]
pub struct SpaceAnalyzeDiscussionResultWire {
    /// The space partition, parsed back from `space_pk`.
    pub pk: Partition,
    /// `SpaceAnalyzeDiscussionResult(report_id, "{discussion_id}#{request_id}")`.
    pub sk: EntityType,

    pub id: Uuid,
    pub space_pk: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub status: AnalyzeReportStatus,
    pub report_id: String,
    pub discussion_id: String,
    pub request_id: String,
    pub params: DiscussionAnalysisParams,
    pub analyzed_comment_count: i64,
    pub topics: TopicRows,
    pub tfidf_terms: TermScores,
    pub network_nodes: NetworkNodes,
    pub network_edges: NetworkEdges,
}

impl From<SpaceAnalyzeDiscussionResult> for SpaceAnalyzeDiscussionResultWire {
    fn from(v: SpaceAnalyzeDiscussionResult) -> Self {
        Self {
            pk: v.space_pk.parse().unwrap_or_default(),
            sk: EntityType::SpaceAnalyzeDiscussionResult(
                v.report_id.clone(),
                format!("{}#{}", v.discussion_id, v.request_id),
            ),

            id: v.id,
            space_pk: v.space_pk,
            created_at: v.created_at,
            updated_at: v.updated_at,
            status: v.status,
            report_id: v.report_id,
            discussion_id: v.discussion_id,
            request_id: v.request_id,
            params: v.params,
            analyzed_comment_count: v.analyzed_comment_count,
            topics: v.topics,
            tfidf_terms: v.tfidf_terms,
            network_nodes: v.network_nodes,
            network_edges: v.network_edges,
        }
    }
}

#[cfg(test)]
mod shipped_client_compat_tests {
    use super::*;

    /// The identity fields the shipped mobile build declares on this model,
    /// copied from commit 38ac1fcd8. Neither carries `#[serde(default)]`.
    #[derive(Debug, serde::Deserialize)]
    #[allow(dead_code)]
    struct ShippedKeys {
        pk: Partition,
        sk: EntityType,
    }

    fn sample() -> SpaceAnalyzeDiscussionResult {
        SpaceAnalyzeDiscussionResult {
            space_pk: "SPACE#s1".into(),
            report_id: "r1".into(),
            discussion_id: "d1".into(),
            request_id: "q1".into(),
            ..Default::default()
        }
    }

    #[test]
    fn shipped_build_can_parse_current_row() {
        let json = serde_json::to_value(sample()).expect("serialize");
        assert_eq!(json["pk"], serde_json::json!("SPACE#s1"));
        // Two ids are packed into the variant's second slot.
        assert_eq!(
            json["sk"],
            serde_json::json!("SPACE_ANALYZE_DISCUSSION_RESULT#r1#d1#q1")
        );
        serde_json::from_value::<ShippedKeys>(json).expect("shipped build must parse this");
    }

    #[test]
    fn shipped_build_breaks_without_legacy_keys() {
        let mut json = serde_json::to_value(sample()).expect("serialize");
        json.as_object_mut().unwrap().remove("pk");
        let err = serde_json::from_value::<ShippedKeys>(json).expect_err("must fail");
        assert!(err.to_string().contains("missing field `pk`"), "got: {err}");
    }
}
