//! JS interop for the Analyze app — Excel export + chart helpers.
//!
//! Mirrors `features/auth/interop/wallet_connect.rs`: each public fn
//! drives a tiny `web/<name>.js` script via `dioxus::document::eval`.
//! `dx_eval` is platform-agnostic (no-op outside web), so no
//! per-target cfg gates are needed at the call site.
//! Direct `wasm_bindgen(js_namespace = […]) extern "C"` mappings are
//! an anti-pattern — see `conventions/anti-patterns.md`.

use dioxus::document::eval as dx_eval;

use crate::features::spaces::pages::apps::apps::analyzes::*;
use crate::features::spaces::pages::apps::types::SpaceAppError;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct DownloadAnalyzeExcelRequest {
    pub file_name: String,
    pub sheet_name: String,
    pub rows: Vec<Vec<String>>,
    pub merges: Vec<AnalyzeExcelMerge>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct AnalyzeExcelMerge {
    pub start_row: usize,
    pub start_col: usize,
    pub end_row: usize,
    pub end_col: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct AnalyzeChartDatum {
    pub label: String,
    pub count: i64,
    pub percentage: f64,
    pub color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct RenderAnalyzeBarChartRequest {
    pub container_id: String,
    pub entries: Vec<AnalyzeChartDatum>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct RenderAnalyzePieChartRequest {
    pub container_id: String,
    pub entries: Vec<AnalyzeChartDatum>,
}

// ── Excel export ──────────────────────────────────────────────────

/// Export the analyze table as an .xlsx and hand it to the user.
///
/// Two delivery paths, because a browser download does not exist on mobile:
///
///   * **Web** — `download_excel.js` lets XLSX click a hidden `<a download>`.
///   * **Native shell** — `build_excel_b64.js` returns the bytes instead, and
///     the `save_file` Tauri command writes them where the platform expects
///     (Android Downloads, or a share sheet). The in-WebView download the web
///     path relies on is silently dropped by Android System WebView and
///     ignored by iOS WKWebView, which is why this fork exists at all.
///
/// Either way, `Ok(())` means the file actually reached the user — the old
/// single path reported success unconditionally, because `writeFileXLSX`
/// returns normally whether or not the browser saved anything.
///
/// The fork is decided at RUNTIME (`is_native_shell`), not by a Cargo feature —
/// the web fullstack build enables `tauri-web` too, so gating on the flag put
/// the native branch in the web bundle and dropped `download_excel.js`.
pub async fn download_analyze_excel(req: DownloadAnalyzeExcelRequest) -> Result<()> {
    use crate::common::utils::native_file;

    let payload = serde_json::to_value(&req).map_err(|_| SpaceAppError::ExcelExportFailed)?;

    if !native_file::is_native_shell().await {
        let mut runner = dx_eval(include_str!("web/download_excel.js"));
        runner
            .send(payload)
            .map_err(|_| SpaceAppError::ExcelExportFailed)?;
        let ok = runner
            .recv::<Option<bool>>()
            .await
            .map_err(|_| SpaceAppError::ExcelExportFailed)?;
        return match ok {
            Some(true) => Ok(()),
            _ => Err(SpaceAppError::ExcelExportFailed.into()),
        };
    }

    use base64::Engine;
    let mut runner = dx_eval(include_str!("web/build_excel_b64.js"));
    runner
        .send(payload)
        .map_err(|_| SpaceAppError::ExcelExportFailed)?;
    let b64 = runner
        .recv::<Option<String>>()
        .await
        .map_err(|_| SpaceAppError::ExcelExportFailed)?
        .ok_or(SpaceAppError::ExcelExportFailed)?;

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(b64.as_bytes())
        .map_err(|_| SpaceAppError::ExcelExportFailed)?;

    crate::common::utils::native_file::save_file(
        &req.file_name,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        &bytes,
    )
    .await
    .map_err(|_| SpaceAppError::ExcelExportFailed.into())
}

// ── Chart helpers (placeholders — call sites land with the chart UI) ─

pub async fn render_analyze_bar_chart(req: &RenderAnalyzeBarChartRequest) -> Result<()> {
    let mut runner = dx_eval(include_str!("web/render_bar_chart.js"));
    runner
        .send(serde_json::to_value(req).map_err(|_| SpaceAppError::ChartRenderFailed)?)
        .map_err(|_| SpaceAppError::ChartRenderFailed)?;
    let ok = runner
        .recv::<Option<bool>>()
        .await
        .map_err(|_| SpaceAppError::ChartRenderFailed)?;
    match ok {
        Some(true) => Ok(()),
        _ => Err(SpaceAppError::ChartRenderFailed.into()),
    }
}

pub async fn render_analyze_pie_chart(req: &RenderAnalyzePieChartRequest) -> Result<()> {
    let mut runner = dx_eval(include_str!("web/render_pie_chart.js"));
    runner
        .send(serde_json::to_value(req).map_err(|_| SpaceAppError::ChartRenderFailed)?)
        .map_err(|_| SpaceAppError::ChartRenderFailed)?;
    let ok = runner
        .recv::<Option<bool>>()
        .await
        .map_err(|_| SpaceAppError::ChartRenderFailed)?;
    match ok {
        Some(true) => Ok(()),
        _ => Err(SpaceAppError::ChartRenderFailed.into()),
    }
}
