import { useNavigate } from "react-router-dom";
import { isTauri, printPage } from "@/lib/native";
import { useToast } from "@/lib/toast";
import { useReportDetailI18n } from "@/pages/spaces/[spaceId]/report/[reportId]/i18n";
import { useReportDetailContext } from "../hooks/use-report-detail";

// app/ratel/src/features/spaces/pages/report/views/detail/top_bar.rs
//
// Top chrome row — back arrow + breadcrumb + autosave + PDF Download /
// Publish buttons.

/**
 * Export the report as a PDF, scoped to the report body via the
 * `@media print` styles in `main.css`.
 *
 * Web: the browser's print dialog (user picks "Save as PDF"). Native shell:
 * `window.print()` is a silent no-op in both Android WebView and iOS
 * WKWebView, so the job goes to the native `print_page` command instead
 * (`lib/native.ts`). The fork is decided at RUNTIME (`isTauri()`), not by a
 * build flag — the web build enables the Tauri transport too.
 */
async function triggerPdfPrint(jobName: string): Promise<void> {
  if (isTauri()) {
    await printPage(jobName);
    return;
  }
  // Tiny delay so any pending React re-render settles before the print
  // snapshot is taken — a chart freshly inserted via the Range API can
  // otherwise flicker in the printed output.
  setTimeout(() => window.print(), 50);
}

export function TopBar() {
  const tr = useReportDetailI18n();
  const navigate = useNavigate();
  const toast = useToast();
  const ctx = useReportDetailContext();

  const autosaveLabel =
    ctx.saveStatus === "Unsaved"
      ? tr.autosaveUnsaved
      : ctx.saveStatus === "Saving"
        ? tr.autosaveSaving
        : tr.autosaveJustNow;

  // Publish keeps the same label across first and subsequent presses —
  // re-publish is the same operation (push the latest body to the
  // published copy), so a separate "Edit & Republish" label would only add
  // surface area without changing what the button does.
  const publishLabel = ctx.publishPending ? tr.publishingLabel : tr.publishBtn;

  return (
    <div className="report-detail__topbar">
      <div className="report-detail__topbar-left">
        <button className="report-detail__back" aria-label={tr.backAria} onClick={() => navigate(-1)}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="report-detail__breadcrumb">
          <span className="report-detail__breadcrumb-root">{tr.breadcrumbRoot}</span>
          <span className="report-detail__breadcrumb-sep">{tr.breadcrumbSeparator}</span>
          <span className="report-detail__breadcrumb-current">{ctx.initialTitle}</span>
        </span>
        {ctx.canEdit && <span className="report-detail__autosave">{autosaveLabel}</span>}
      </div>
      <div className="report-detail__topbar-right">
        <button
          className="report-detail__topbar-btn"
          aria-label={tr.pdfDownloadBtn}
          data-testid="pdf-download"
          onClick={() => {
            void (async () => {
              try {
                // The report title names the exported file so a saved PDF is
                // identifiable in Files/Downloads rather than landing as
                // "document.pdf".
                await triggerPdfPrint(ctx.initialTitle);
              } catch {
                toast.warn(tr.pdfDownloadFailed);
              }
            })();
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="9" y1="15" x2="15" y2="15" />
            <line x1="12" y1="12" x2="12" y2="18" />
            <polyline points="10 16 12 18 14 16" />
          </svg>
          <span>{tr.pdfDownloadBtn}</span>
        </button>
        {/* Publish is a one-shot — visible only to admins on a Draft. Once
            Published the button disappears entirely; subsequent edits stream
            into the published copy via the autosave loop. */}
        {ctx.canEdit && !ctx.isPublished && (
          <button
            className="report-detail__topbar-btn report-detail__topbar-btn--primary"
            data-testid="publish-report"
            disabled={ctx.publishPending}
            onClick={() => {
              if (ctx.publishPending) return;
              ctx.openPublishModal();
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>{publishLabel}</span>
          </button>
        )}
      </div>
    </div>
  );
}
