//! Delete a saved analyze report together with everything derived from it.
//!
//! A report owns three kinds of rows, all keyed by its `report_id`:
//! the report itself (`space_analyze_reports`), its 1:1 poll/quiz/follow
//! aggregate (`space_analyze_report_results`), and the history of
//! user-triggered discussion analyses (`space_analyze_discussion_results`).
//! All three are removed in one transaction so a failure never leaves an
//! orphaned result behind a vanished report.
//!
//! Quota: the per-space report quota enforced by `create_analyze_report`
//! counts live report rows, so deleting a report frees one slot.
//!
//! In-flight runs: deletion is rejected with
//! `SpaceAppError::AnalyzeReportDeleteWhileRunning` while the report's own
//! aggregation or any of its discussion analyses is still `InProgress` and
//! younger than [`REANALYZE_STALE_AFTER_MS`]. Those pipelines write their
//! results back by `report_id` / row id when they finish, so deleting under
//! them would either recreate an orphaned result row or make the outbox
//! retry a dead update until it is dead-lettered. Runs older than the stale
//! window are treated as crashed and do not block deletion, matching the
//! re-analysis guard.

use crate::features::spaces::pages::apps::apps::analyzes::*;
use crate::features::spaces::pages::apps::models::SpaceApp;
use crate::features::spaces::pages::apps::types::SpaceAppError;
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[mcp_tool(
    name = "delete_analyze_report",
    description = "Delete a saved analyze report and its stored poll/quiz/follow result and discussion analysis history. Frees one report quota slot. Rejected while the report or one of its discussion analyses is still running. Requires creator role."
)]
#[delete(
    "/api/spaces/{space_id}/apps/analyzes/reports/{report_id}",
    role: SpaceUserRole
)]
pub async fn delete_analyze_report(
    #[mcp(description = "Space partition key")] space_id: SpacePartition,
    #[mcp(description = "Analyze report id")] report_id: SpaceAnalyzeReportEntityType,
) -> Result<String> {
    use crate::common::utils::time::get_now_timestamp_millis;
    use postgres::ops::{EnumOp, StringOp};

    SpaceApp::can_edit(role)?;
    let space_pk: Partition = space_id.into();
    let report_id_str = report_id.to_string();

    let report = SpaceAnalyzeReport::get_for_space(&space_pk, &report_id_str)
        .await?
        .ok_or(Error::NotFound("Analyze report not found".into()))?;

    let running_discussions = SpaceAnalyzeDiscussionResult::repository()
        .find(
            SpaceAnalyzeDiscussionResult::query()
                .space_pk(StringOp::Eq(space_pk.to_string()))
                .report_id(StringOp::Eq(report_id_str.clone()))
                .status(EnumOp::Eq(AnalyzeReportStatus::InProgress)),
        )
        .await
        .map_err(|e| {
            crate::error!("delete_analyze_report: discussion run lookup failed: {e}");
            Error::Internal
        })?;
    let discussion_runs: Vec<(AnalyzeReportStatus, i64)> = running_discussions
        .items
        .iter()
        .map(|row| (row.status, row.updated_at))
        .collect();

    let now = get_now_timestamp_millis();
    if !can_delete(report.status, report.updated_at, &discussion_runs, now) {
        return Err(SpaceAppError::AnalyzeReportDeleteWhileRunning.into());
    }

    let tx = postgres::Tx::begin().await.map_err(|e| {
        crate::error!("delete_analyze_report: tx begin failed: {e}");
        Error::Internal
    })?;
    SpaceAnalyzeDiscussionResult::repository()
        .with_tx(&tx)
        .db()
        .execute(delete_by_report_query(
            &SpaceAnalyzeDiscussionResult::table_name(),
            &space_pk,
            &report_id_str,
        ))
        .await
        .map_err(|e| {
            crate::error!("delete_analyze_report: discussion results delete failed: {e}");
            Error::Internal
        })?;
    SpaceAnalyzeReportResult::repository()
        .with_tx(&tx)
        .db()
        .execute(delete_by_report_query(
            &SpaceAnalyzeReportResult::table_name(),
            &space_pk,
            &report_id_str,
        ))
        .await
        .map_err(|e| {
            crate::error!("delete_analyze_report: report result delete failed: {e}");
            Error::Internal
        })?;
    SpaceAnalyzeReport::repository()
        .with_tx(&tx)
        .delete(report.id)
        .await
        .map_err(|e| {
            crate::error!("delete_analyze_report: report delete failed: {e}");
            Error::Internal
        })?;
    tx.commit().await.map_err(|e| {
        crate::error!("delete_analyze_report: tx commit failed: {e}");
        Error::Internal
    })?;

    Ok("success".to_string())
}

/// Builds `DELETE FROM "<table>" WHERE space_pk = $1 AND report_id = $2`
/// for the tables that hang off a report by its string id.
#[cfg(feature = "server")]
fn delete_by_report_query(
    table: &str,
    space_pk: &Partition,
    report_id: &str,
) -> postgres::sqlx::QueryBuilder<'static, postgres::sqlx::Postgres> {
    let mut qb = postgres::sqlx::QueryBuilder::<postgres::sqlx::Postgres>::new(format!(
        "DELETE FROM \"{table}\" WHERE space_pk = "
    ));
    postgres::Value::from(space_pk.to_string()).push_bind(&mut qb);
    qb.push(" AND report_id = ");
    postgres::Value::from(report_id.to_string()).push_bind(&mut qb);
    qb
}

/// `true` when neither the report's aggregation nor any of its discussion
/// analyses (`(status, updated_at)` pairs) has a run in flight that started
/// less than [`REANALYZE_STALE_AFTER_MS`] ago.
pub fn can_delete(
    report_status: AnalyzeReportStatus,
    report_updated_at: i64,
    discussion_runs: &[(AnalyzeReportStatus, i64)],
    now: i64,
) -> bool {
    can_reanalyze(report_status, report_updated_at, now)
        && discussion_runs
            .iter()
            .all(|(status, updated_at)| can_reanalyze(*status, *updated_at, now))
}

#[cfg(test)]
mod tests {
    use super::*;

    const STARTED: i64 = 1_000_000;

    #[test]
    fn settled_report_without_running_discussions_can_be_deleted() {
        assert!(can_delete(
            AnalyzeReportStatus::Finish,
            STARTED,
            &[],
            STARTED + 1
        ));
        assert!(can_delete(
            AnalyzeReportStatus::Failed,
            STARTED,
            &[],
            STARTED + 1
        ));
        assert!(can_delete(
            AnalyzeReportStatus::Finish,
            STARTED,
            &[
                (AnalyzeReportStatus::Finish, STARTED),
                (AnalyzeReportStatus::Failed, STARTED)
            ],
            STARTED + 1
        ));
    }

    #[test]
    fn fresh_report_run_blocks_deletion() {
        assert!(!can_delete(
            AnalyzeReportStatus::InProgress,
            STARTED,
            &[],
            STARTED + REANALYZE_STALE_AFTER_MS - 1
        ));
    }

    #[test]
    fn fresh_discussion_run_blocks_deletion() {
        assert!(!can_delete(
            AnalyzeReportStatus::Finish,
            STARTED,
            &[(AnalyzeReportStatus::InProgress, STARTED)],
            STARTED + REANALYZE_STALE_AFTER_MS - 1
        ));
    }

    #[test]
    fn stale_runs_do_not_block_deletion() {
        assert!(can_delete(
            AnalyzeReportStatus::InProgress,
            STARTED,
            &[(AnalyzeReportStatus::InProgress, STARTED)],
            STARTED + REANALYZE_STALE_AFTER_MS
        ));
    }
}
