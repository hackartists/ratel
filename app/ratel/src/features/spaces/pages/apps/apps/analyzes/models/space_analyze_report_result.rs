//! Auto-computed analysis result for a saved AnalyzeReport (1:1 by
//! `report_id`). Postgres migration: surrogate `id` PK; the DynamoDB
//! `(Space, SpaceAnalyzeReportResult(report_id))` identity becomes the
//! `unique(report_id)` natural key. `space_pk` / `report_id` are stored
//! as plain strings (cross-row references); aggregate lists are opaque
//! jsonb.

use crate::features::spaces::pages::apps::apps::analyzes::*;
use uuid::Uuid;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[cfg(feature = "server")]
use postgres::PostgresEntity;

/// jsonb wrapper for poll aggregates.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[cfg_attr(
    feature = "server",
    derive(postgres::PostgresJson)
)]
pub struct PollAggregates(pub Vec<PollQuestionAggregate>);
impl std::ops::Deref for PollAggregates {
    type Target = Vec<PollQuestionAggregate>;
    fn deref(&self) -> &Vec<PollQuestionAggregate> {
        &self.0
    }
}

/// jsonb wrapper for quiz aggregates.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[cfg_attr(
    feature = "server",
    derive(postgres::PostgresJson)
)]
pub struct QuizAggregates(pub Vec<QuizQuestionAggregate>);
impl std::ops::Deref for QuizAggregates {
    type Target = Vec<QuizQuestionAggregate>;
    fn deref(&self) -> &Vec<QuizQuestionAggregate> {
        &self.0
    }
}

/// jsonb wrapper for follow aggregates.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[cfg_attr(
    feature = "server",
    derive(postgres::PostgresJson)
)]
pub struct FollowAggregates(pub Vec<FollowTargetAggregate>);
impl std::ops::Deref for FollowAggregates {
    type Target = Vec<FollowTargetAggregate>;
    fn deref(&self) -> &Vec<FollowTargetAggregate> {
        &self.0
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[cfg_attr(
    feature = "server",
    derive(PostgresEntity)
)]
#[cfg_attr(feature = "server", postgres(table = "space_analyze_report_results"))]
pub struct SpaceAnalyzeReportResult {
    pub id: Uuid,

    #[cfg_attr(feature = "server", postgres(index))]
    pub space_pk: String,

    #[cfg_attr(feature = "server", postgres(order))]
    pub created_at: i64,
    pub updated_at: i64,

    /// 1:1 with the parent report.
    #[cfg_attr(feature = "server", postgres(unique))]
    #[serde(default)]
    pub report_id: String,

    #[serde(default)]
    pub respondent_count: i64,

    #[serde(default)]
    pub poll_aggregates: PollAggregates,

    #[serde(default)]
    pub quiz_aggregates: QuizAggregates,

    #[serde(default)]
    pub follow_aggregates: FollowAggregates,
}

#[cfg(feature = "server")]
impl SpaceAnalyzeReportResult {
    pub fn new(space_pk: Partition, report_id: String) -> Self {
        use crate::common::utils::time::get_now_timestamp_millis;

        let now = get_now_timestamp_millis();

        Self {
            id: Uuid::now_v7(),
            space_pk: space_pk.to_string(),
            created_at: now,
            updated_at: now,
            report_id,
            respondent_count: 0,
            poll_aggregates: PollAggregates(Vec::new()),
            quiz_aggregates: QuizAggregates(Vec::new()),
            follow_aggregates: FollowAggregates(Vec::new()),
        }
    }

    /// The result row for a report (1:1), scoped to its space, if any.
    pub async fn get_for_report(
        space_pk: &Partition,
        report_id: &str,
    ) -> crate::common::Result<Option<Self>> {
        use postgres::ops::StringOp;
        Ok(Self::repository()
            .find_one(
                Self::query()
                    .report_id(StringOp::Eq(report_id.to_string()))
                    .space_pk(StringOp::Eq(space_pk.to_string())),
            )
            .await?)
    }
}
