import type { ReactNode } from "react";
import type { ChartType } from "@ratel/ts-bridges";
import { dataBool } from "@/lib/dom";
import { useReportDetailI18n } from "@/i18n/generated/features/spaces/pages/report/views/detail/report-detail.i18n";
import { chartTypeOptionsFor, chartTypeToken, scrollToOutlineEntry, type OutlineEntry, type OutlineKind } from "./chart-figure-html";
import { useReportDetailContext } from "../hooks/use-report-detail";

// app/ratel/src/features/spaces/pages/report/views/detail/outline.rs
//
// Right rail — default mode shows the auto-derived outline + meta;
// chart-swap mode shows a source picker for one chart block.

export function Outline() {
  const ctx = useReportDetailContext();
  return (
    <aside className="report-detail__outline">
      {ctx.outlineMode.kind === "Default" ? (
        <OutlineDefault />
      ) : (
        <OutlineSwap chartId={ctx.outlineMode.chartId} />
      )}
    </aside>
  );
}

function OutlineDefault() {
  const tr = useReportDetailI18n();
  const ctx = useReportDetailContext();
  return (
    <>
      <div className="report-detail__outline-section">
        <div className="report-detail__outline-heading">{tr.outlineHeading}</div>
        {ctx.outline.length === 0 ? (
          <div className="report-detail__outline-empty">{tr.outlineEmpty}</div>
        ) : (
          <div className="report-detail__outline-list">
            {ctx.outline.map((entry) => (
              <OutlineRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>
      <div className="report-detail__outline-section">
        <div className="report-detail__outline-heading">{tr.metaHeading}</div>
        <div className="report-detail__outline-meta">
          <MetaRow label={tr.metaAuthor} value={ctx.author} />
          <MetaRow label={tr.metaCreated} value={ctx.createdRelative} />
          <MetaRow label={tr.metaEdited} value={ctx.editedRelative} />
        </div>
      </div>
    </>
  );
}

/**
 * Chart-type swap mode — picks a new visual rendering for the focused chart
 * figure. The option list is filtered by the chart's source
 * (`chartTypeOptionsFor(source)`): poll/quiz/follow get Bar/Pie/Table,
 * discussion gets LDA/TF-IDF/Network. Source stays the same — only the
 * rendering shape changes.
 */
function OutlineSwap({ chartId }: { chartId: string }) {
  const tr = useReportDetailI18n();
  const ctx = useReportDetailContext();
  const meta = ctx.chartMeta(chartId);
  const currentType = meta?.chartType ?? "Bar";
  const source = meta?.source ?? "Poll";
  const title = meta?.itemTitle ?? "";
  const options = chartTypeOptionsFor(source);

  return (
    <div className="report-detail__outline-section report-detail__outline-swap">
      <div className="report-detail__outline-swap-head">
        <div className="report-detail__outline-swap-title-col">
          <span className="report-detail__outline-swap-eyebrow">{tr.outlineSwapEyebrow}</span>
          <span className="report-detail__outline-swap-title">{title}</span>
        </div>
        <button
          className="report-detail__outline-swap-close"
          aria-label={tr.outlineSwapCloseAria}
          onClick={() => ctx.closeOutlineSwap()}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div className="report-detail__outline-swap-list">
        {options.map((ct) => (
          <SwapOption key={chartTypeToken(ct)} chartId={chartId} chartType={ct} active={ct === currentType} />
        ))}
      </div>
      <div className="report-detail__outline-swap-hint">{tr.outlineSwapHint}</div>
    </div>
  );
}

function SwapOption({ chartId, chartType, active }: { chartId: string; chartType: ChartType; active: boolean }) {
  const tr = useReportDetailI18n();
  const ctx = useReportDetailContext();
  const [label, hint, icon] = swapOptionCopy(chartType, tr);

  return (
    <button
      className="report-detail__swap-opt"
      data-type={chartTypeToken(chartType)}
      aria-selected={dataBool(active)}
      type="button"
      onClick={() => ctx.swapChartType(chartId, chartType)}
    >
      <div className="report-detail__swap-opt-icon">{icon}</div>
      <div className="report-detail__swap-opt-text">
        <span className="report-detail__swap-opt-label">{label}</span>
        <span className="report-detail__swap-opt-hint">{hint}</span>
      </div>
    </button>
  );
}

function swapOptionCopy(
  chartType: ChartType,
  tr: ReturnType<typeof useReportDetailI18n>,
): [string, string, ReactNode] {
  switch (chartType) {
    case "Bar":
      return [tr.chartTypeBarLabel, tr.chartTypeBarDesc, swapIconBar()];
    case "Pie":
      return [tr.chartTypePieLabel, tr.chartTypePieDesc, swapIconPie()];
    case "Table":
      return [tr.chartTypeTableLabel, tr.chartTypeTableDesc, swapIconTable()];
    case "Lda":
      return [tr.chartTypeLdaLabel, tr.chartTypeLdaDesc, swapIconLda()];
    case "TfIdf":
      return [tr.chartTypeTfidfLabel, tr.chartTypeTfidfDesc, swapIconTfidf()];
    case "Network":
      return [tr.chartTypeNetworkLabel, tr.chartTypeNetworkDesc, swapIconNetwork()];
    // `TextList` never reaches this branch — the chart-type swap button is
    // hidden on TextList figures — kept for exhaustiveness.
    case "TextList":
      return [tr.chartTypeTextlistLabel, tr.chartTypeTextlistDesc, swapIconTable()];
  }
}

function swapIconBar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}
function swapIconPie() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
      <path d="M22 12A10 10 0 0 0 12 2v10z" />
    </svg>
  );
}
function swapIconTable() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  );
}
function swapIconLda() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="6" cy="6" r="2" fill="currentColor" />
      <circle cx="18" cy="6" r="2" fill="currentColor" />
      <circle cx="6" cy="18" r="2" fill="currentColor" />
      <circle cx="18" cy="18" r="2" fill="currentColor" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}
function swapIconTfidf() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <text x="3" y="17" fontFamily="Orbitron" fontSize="10" fontWeight="800" fill="currentColor">
        Aa
      </text>
      <line x1="14" y1="6" x2="21" y2="6" />
      <line x1="14" y1="12" x2="21" y2="12" />
      <line x1="14" y1="18" x2="19" y2="18" />
    </svg>
  );
}
function swapIconNetwork() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="6" cy="6" r="2.4" fill="currentColor" />
      <circle cx="18" cy="6" r="2" fill="currentColor" />
      <circle cx="6" cy="18" r="2" fill="currentColor" />
      <circle cx="18" cy="18" r="2.2" fill="currentColor" />
      <circle cx="12" cy="12" r="2.6" fill="currentColor" />
      <line x1="8" y1="8" x2="10" y2="10" />
      <line x1="14" y1="14" x2="16" y2="16" />
      <line x1="8" y1="16" x2="10" y2="14" />
      <line x1="14" y1="10" x2="16" y2="8" />
    </svg>
  );
}

function OutlineRow({ entry }: { entry: OutlineEntry }) {
  const kindClass =
    entry.kind === "H1"
      ? "report-detail__outline-row--h1"
      : entry.kind === "H2"
        ? "report-detail__outline-row--h2"
        : entry.kind === "H3"
          ? "report-detail__outline-row--h3"
          : "report-detail__outline-row--chart";
  return (
    <button
      className={`report-detail__outline-row ${kindClass}`}
      type="button"
      onClick={() => scrollToOutlineEntry(entry.id, entry.kind as OutlineKind)}
    >
      <span>{entry.label}</span>
    </button>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="report-detail__meta-row">
      <span className="report-detail__meta-key">{label}</span>
      <span className="report-detail__meta-val">{value}</span>
    </div>
  );
}
