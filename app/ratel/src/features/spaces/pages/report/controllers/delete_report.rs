use crate::features::spaces::pages::report::*;
#[cfg(feature = "server")]
use postgres::PostgresEntity;

/// `Default` is required by the `test_*!` macros — they fall back to
/// `<Resp>::default()` when a non-2xx response body fails to parse
/// into the typed shape.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct DeleteReportResponse {
    pub id: String,
}

/// Remove one saved report from a space. Auth: `SpaceReport::can_delete`
/// — only the space Creator (or a team Admin/Owner of a team-owned
/// space, which the extractor collapses to `Creator`) may delete.
///
/// The endpoint is idempotent — deleting a missing row is treated as
/// success because the UI flow happily fires the request again on
/// retries / double-clicks and we don't want a 4xx to leak through
/// the confirm modal.
#[delete("/v3/spaces/{space_pk}/reports/{report_id}", role: SpaceUserRole)]
pub async fn delete_report(
    space_pk: SpacePartition,
    report_id: SpaceReportEntityType,
) -> Result<DeleteReportResponse> {
    use crate::features::spaces::pages::report::models::SpaceReport;
    use crate::features::spaces::pages::report::types::SpaceReportError;

    SpaceReport::can_delete(role)?;
    let _ = space_pk;

    let report_uuid =
        uuid::Uuid::parse_str(&report_id.0).map_err(|_| SpaceReportError::ReportNotFound)?;

    // Idempotent delete — swallow NotFound so retries/double-clicks succeed.
    match SpaceReport::delete_by_id(report_uuid).await {
        Ok(_) => {}
        Err(postgres::Error::NotFound) => {}
        Err(e) => {
            crate::error!("failed to delete report: {e:?}");
            return Err(SpaceReportError::ReportDeleteFailed.into());
        }
    }

    Ok(DeleteReportResponse { id: report_id.0 })
}
