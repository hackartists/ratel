use crate::features::spaces::pages::report::*;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct UpdateAnalyzeHtmlRequest {
    pub html_contents: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct UpdateAnalyzeResponse {
    pub html_contents: Option<String>,
}

// FIXME: implement middleware and authorization
#[patch("/v3/spaces/{space_pk}/analyze")]
pub async fn update_analyze(
    space_pk: SpacePartition,
    req: UpdateAnalyzeHtmlRequest,
) -> Result<UpdateAnalyzeResponse> {
    use crate::features::spaces::pages::report::models::SpaceAnalyze;
    use crate::features::spaces::pages::report::types::SpaceReportError;

    let mut analyze = SpaceAnalyze::get_for(&space_pk)
        .await
        .map_err(|e| {
            crate::error!("update_analyze: failed to load analyze: {:?}", e);
            SpaceReportError::AnalyzeLoadFailed
        })?
        .unwrap_or_default();

    if analyze.space_id.is_empty() {
        analyze.space_id = space_pk.0.clone();
    }
    if analyze.created_at == 0 {
        analyze.created_at = crate::common::utils::time::get_now_timestamp_millis();
    }
    analyze.html_contents = Some(req.html_contents.clone());

    SpaceAnalyze::repository()
        .upsert_on(&["space_id"], &analyze)
        .await
        .map_err(|e| {
            crate::error!("failed to update analyze: {e:?}");
            SpaceReportError::AnalyzeUpdateFailed
        })?;

    Ok(UpdateAnalyzeResponse {
        html_contents: Some(req.html_contents),
    })
}
