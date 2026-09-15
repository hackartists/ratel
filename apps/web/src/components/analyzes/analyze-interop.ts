// Excel export for the Analyze app, shared by the analyze poll page and the
// saved-report page.
//
// The workbook is built with SheetJS (`xlsx`), loaded on the first export so it
// stays out of every other page's JavaScript. `buildWorkbook` is the one the
// former global bundle used (shell-js `spaces/apps/analyzes.js`), line for line,
// so the spreadsheet does not change. Web: SheetJS triggers the browser
// download. Tauri: the bytes go through the native `save_file` command, because
// a WebView drops `<a download>` (Android has no DownloadListener, iOS WKWebView
// ignores the attribute). Any failure surfaces as `SpaceAppError::ExcelExportFailed`.
import type { WorkBook } from "xlsx";
import { isTauri, saveFile } from "@/lib/native";

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

/** A `SpaceAppError` variant raised in the browser (Rust `SpaceAppError::*`). */
export class SpaceAppLocalError extends Error {
  constructor(public readonly variant: "ExcelExportFailed") {
    super(variant);
    this.name = "SpaceAppLocalError";
  }
}

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

type Xlsx = typeof import("xlsx");

function buildWorkbook(XLSX: Xlsx, req: Partial<DownloadAnalyzeExcelRequest>): WorkBook {
  const sheetName = String(req.sheet_name || "Responses");
  const rows = Array.isArray(req.rows) && req.rows.length > 0 ? req.rows : [["ID", "조사구분", "유형", "질문지"]];
  const merges = Array.isArray(req.merges) ? req.merges : [];

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!merges"] = merges.map((merge) => ({
    s: { r: Number(merge.start_row || 0), c: Number(merge.start_col || 0) },
    e: { r: Number(merge.end_row || 0), c: Number(merge.end_col || 0) },
  }));
  worksheet["!cols"] = rows[0].map((_, index) => {
    if (index === 0) return { wch: 24 };
    if (index === 1) return { wch: 18 };
    if (index === 2) return { wch: 10 };
    if (index === 3) return { wch: 48 };
    return { wch: 32 };
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  return workbook;
}

/**
 * Rust `download_analyze_excel`. Resolves only when the file reached the user.
 */
export async function downloadAnalyzeExcel(req: DownloadAnalyzeExcelRequest): Promise<void> {
  let XLSX: Xlsx;
  try {
    XLSX = await import("xlsx");
  } catch (e) {
    console.error("loading xlsx failed", e);
    throw new SpaceAppLocalError("ExcelExportFailed");
  }

  if (!isTauri()) {
    try {
      XLSX.writeFileXLSX(buildWorkbook(XLSX, req), String(req.file_name || "poll-analysis.xlsx"), {
        compression: true,
      });
      return;
    } catch (e) {
      console.error("downloadExcel failed", e);
      throw new SpaceAppLocalError("ExcelExportFailed");
    }
  }

  let bytes: Uint8Array;
  try {
    const out: unknown = XLSX.write(buildWorkbook(XLSX, req), { bookType: "xlsx", type: "array", compression: true });
    if (!(out instanceof ArrayBuffer) || out.byteLength === 0) throw new Error("empty workbook");
    bytes = new Uint8Array(out);
  } catch (e) {
    console.error("building the workbook failed", e);
    throw new SpaceAppLocalError("ExcelExportFailed");
  }
  try {
    await saveFile(req.file_name, XLSX_MIME, bytes);
  } catch {
    throw new SpaceAppLocalError("ExcelExportFailed");
  }
}
