//! Re-run an existing analyze report against the space's CURRENT data.
//!
//! Analyze results are computed once by the `AnalyzeReportAlreadyRunning`
//! outbox handler and persisted on `SpaceAnalyzeReportResult`, so the
//! detail page never reflects responses submitted after the report was
//! created. This endpoint re-captures the matched records from the saved
//! filters, flips the report back to `InProgress`, and emits a `MODIFY`
//! outbox event on the same topic so the unchanged
//! `auto_analysis::process_analyze_report` pipeline recomputes and
//! overwrites the result row in place.
//!
//! Quota: re-analysis reuses the existing report row, so it does not
//! consume the per-space report quota enforced by `create_analyze_report`.

use crate::features::spaces::pages::apps::apps::analyzes::*;
use crate::features::spaces::pages::apps::models::SpaceApp;
use crate::features::spaces::pages::apps::types::SpaceAppError;
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

/// A report stuck in `InProgress` for longer than this (pipeline crash,
/// dead-lettered event) may be re-analyzed again; younger in-flight runs
/// are rejected with `SpaceAppError::AnalyzeReportAlreadyRunning`.
pub const REANALYZE_STALE_AFTER_MS: i64 = 10 * 60 * 1000;

#[mcp_tool(
    name = "reanalyze_analyze_report",
    description = "Re-run an existing analyze report against the space's current poll/quiz/follow data. Overwrites the stored aggregates once the pipeline finishes; does not consume report quota. Rejected while a run is already in progress. Requires creator role."
)]
#[post(
    "/api/spaces/{space_id}/apps/analyzes/reports/{report_id}/reanalyze",
    role: SpaceUserRole
)]
pub async fn reanalyze_analyze_report(
    #[mcp(description = "Space partition key")] space_id: SpacePartition,
    #[mcp(description = "Analyze report id")] report_id: SpaceAnalyzeReportEntityType,
) -> Result<AnalyzeReport> {
    use crate::common::utils::time::get_now_timestamp_millis;

    SpaceApp::can_edit(role)?;
    let common_config = crate::common::CommonConfig::default();
    let cli = common_config.dynamodb();
    let space_pk: Partition = space_id.into();
    let report_id_str = report_id.to_string();

    let old = SpaceAnalyzeReport::get_for_space(&space_pk, &report_id_str)
        .await?
        .ok_or(Error::NotFound("Analyze report not found".into()))?;

    let now = get_now_timestamp_millis();
    if !can_reanalyze(old.status, old.updated_at, now) {
        return Err(SpaceAppError::AnalyzeReportAlreadyRunning.into());
    }

    let matched_records = if old.filters.is_empty() {
        Vec::new()
    } else {
        let (_intersection, _data_count, records) =
            services::intersection::intersect_filters(cli, &space_pk, &old.filters).await?;
        records
    };

    let tx = postgres::Tx::begin().await.map_err(|e| {
        crate::error!("reanalyze_analyze_report: tx begin failed: {e}");
        Error::Internal
    })?;
    let updated = SpaceAnalyzeReport::repository()
        .with_tx(&tx)
        .update(
            old.id,
            SpaceAnalyzeReport::update()
                .status(AnalyzeReportStatus::InProgress)
                .matched_records(MatchedRecords(matched_records))
                .updated_at(now),
        )
        .await
        .map_err(|e| {
            crate::error!("reanalyze_analyze_report: report update failed: {e}");
            Error::Internal
        })?;
    crate::common::events::outbox::EventOutbox::emit_modify_tx(
        &tx,
        crate::common::events::outbox::topic::SPACE_ANALYZE_REPORT,
        &old,
        &updated,
    )
    .await
    .map_err(|e| {
        crate::error!("reanalyze_analyze_report: outbox emit failed: {e}");
        Error::Internal
    })?;
    tx.commit().await.map_err(|e| {
        crate::error!("reanalyze_analyze_report: tx commit failed: {e}");
        Error::Internal
    })?;

    Ok(AnalyzeReport {
        id: updated.report_id(),
        name: updated.name,
        status: updated.status,
        created_at: updated.created_at,
        filters: updated.filters.0,
    })
}

/// `true` unless the report already has a run in flight that started
/// less than [`REANALYZE_STALE_AFTER_MS`] ago.
pub fn can_reanalyze(status: AnalyzeReportStatus, updated_at: i64, now: i64) -> bool {
    match status {
        AnalyzeReportStatus::InProgress => now - updated_at >= REANALYZE_STALE_AFTER_MS,
        AnalyzeReportStatus::Finish | AnalyzeReportStatus::Failed => true,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finished_and_failed_reports_can_be_reanalyzed() {
        assert!(can_reanalyze(AnalyzeReportStatus::Finish, 1_000, 1_001));
        assert!(can_reanalyze(AnalyzeReportStatus::Failed, 1_000, 1_001));
    }

    #[test]
    fn fresh_in_progress_run_blocks_reanalysis() {
        let started = 1_000_000;
        assert!(!can_reanalyze(
            AnalyzeReportStatus::InProgress,
            started,
            started + REANALYZE_STALE_AFTER_MS - 1
        ));
    }

    #[test]
    fn stale_in_progress_run_can_be_reanalyzed() {
        let started = 1_000_000;
        assert!(can_reanalyze(
            AnalyzeReportStatus::InProgress,
            started,
            started + REANALYZE_STALE_AFTER_MS
        ));
    }
}
