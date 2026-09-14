// app/ratel/src/features/spaces/pages/apps/apps/analyzes/interop/mod.rs — the
// Analyze app's JS interop (Excel export + d3 chart helpers), shared by the
// analyze poll page and the saved-report page.
//
// The Rust drivers (`interop/web/*.js`) call
// `window.ratel.spaces.apps.analyzes.*`, registered by the global
// `ratel-app-shell.js` (apps/web/shell-js/src/ratel-app-shell/spaces/apps/analyzes.js).
// These functions call the same helpers with the same JSON payloads, and map a
// missing helper or a thrown error to `SpaceAppError::*` like the drivers'
// `dioxus.send(null)`.
import { isTauri, saveFile } from "@/lib/native";

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Rust `AnalyzeExcelMerge`. */
export interface AnalyzeExcelMerge {
  start_row: number;
  start_col: number;
  end_row: number;
  end_col: number;
}

/** Rust `DownloadAnalyzeExcelRequest`. */
export interface DownloadAnalyzeExcelRequest {
  file_name: string;
  sheet_name: string;
  rows: string[][];
  merges: AnalyzeExcelMerge[];
}

/** Rust `AnalyzeChartDatum`. */
export interface AnalyzeChartDatum {
  label: string;
  count: number;
  percentage: number;
  color: string;
}

/** Rust `RenderAnalyzeBarChartRequest` / `RenderAnalyzePieChartRequest`. */
export interface RenderAnalyzeChartRequest {
  container_id: string;
  entries: AnalyzeChartDatum[];
}

/** A `SpaceAppError` variant raised in the browser (Rust `SpaceAppError::*`). */
export class SpaceAppLocalError extends Error {
  constructor(public readonly variant: "ExcelExportFailed" | "ChartRenderFailed") {
    super(variant);
    this.name = "SpaceAppLocalError";
  }
}

interface AnalyzesGlobal {
  downloadExcel?: (req: DownloadAnalyzeExcelRequest) => Promise<void> | void;
  buildExcelBase64?: (req: DownloadAnalyzeExcelRequest) => Promise<string> | string;
  renderBarChart?: (req: RenderAnalyzeChartRequest) => void;
  renderPieChart?: (req: RenderAnalyzeChartRequest) => void;
}

function analyzesGlobal(): AnalyzesGlobal | undefined {
  const w = window as unknown as { ratel?: { spaces?: { apps?: { analyzes?: AnalyzesGlobal } } } };
  return w?.ratel?.spaces?.apps?.analyzes;
}

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Rust `download_analyze_excel`. Web: `downloadExcel` (XLSX clicks a hidden
 * `<a download>`). Native shell: `buildExcelBase64` + the `save_file` command.
 * Resolves only when the file reached the user.
 */
export async function downloadAnalyzeExcel(req: DownloadAnalyzeExcelRequest): Promise<void> {
  if (!isTauri()) {
    try {
      const fn = analyzesGlobal()?.downloadExcel;
      if (typeof fn !== "function") throw new SpaceAppLocalError("ExcelExportFailed");
      await fn(req);
      return;
    } catch (e) {
      if (!(e instanceof SpaceAppLocalError)) console.error("downloadExcel failed", e);
      throw new SpaceAppLocalError("ExcelExportFailed");
    }
  }

  let b64: string | null = null;
  try {
    const fn = analyzesGlobal()?.buildExcelBase64;
    if (typeof fn === "function") {
      const out = await fn(req);
      b64 = typeof out === "string" && out.length > 0 ? out : null;
    }
  } catch (e) {
    console.error("buildExcelBase64 failed", e);
  }
  if (b64 === null) throw new SpaceAppLocalError("ExcelExportFailed");
  try {
    await saveFile(req.file_name, XLSX_MIME, base64ToBytes(b64));
  } catch {
    throw new SpaceAppLocalError("ExcelExportFailed");
  }
}

/** Rust `render_analyze_bar_chart`. */
export async function renderAnalyzeBarChart(req: RenderAnalyzeChartRequest): Promise<void> {
  try {
    const fn = analyzesGlobal()?.renderBarChart;
    if (typeof fn !== "function") throw new SpaceAppLocalError("ChartRenderFailed");
    fn(req);
  } catch (e) {
    if (!(e instanceof SpaceAppLocalError)) console.error("renderBarChart failed", e);
    throw new SpaceAppLocalError("ChartRenderFailed");
  }
}

/** Rust `render_analyze_pie_chart`. */
export async function renderAnalyzePieChart(req: RenderAnalyzeChartRequest): Promise<void> {
  try {
    const fn = analyzesGlobal()?.renderPieChart;
    if (typeof fn !== "function") throw new SpaceAppLocalError("ChartRenderFailed");
    fn(req);
  } catch (e) {
    if (!(e instanceof SpaceAppLocalError)) console.error("renderPieChart failed", e);
    throw new SpaceAppLocalError("ChartRenderFailed");
  }
}
