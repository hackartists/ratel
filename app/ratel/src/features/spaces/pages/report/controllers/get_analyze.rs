use crate::features::spaces::pages::report::*;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct GetAnalyzeResponse {
    pub html_contents: Option<String>,
}

// FIXME: implement middleware and authorization
#[get("/v3/spaces/{space_pk}/analyze")]
pub async fn get_analyze(space_pk: SpacePartition) -> Result<GetAnalyzeResponse> {
    use crate::features::spaces::pages::report::models::SpaceAnalyze;
    use crate::features::spaces::pages::report::types::SpaceReportError;

    let analyze = SpaceAnalyze::get_for(&space_pk).await.map_err(|e| {
        crate::error!("failed to load analyze: {e}");
        SpaceReportError::AnalyzeLoadFailed
    })?;
    let html_contents = analyze.and_then(|item| item.html_contents);

    Ok(GetAnalyzeResponse { html_contents })
}
