import type { ActionSource, Analyze, AnalyzeItem, CrossFilterChip } from "@ratel/ts-bridges";
import { dataBool } from "@/lib/dom";
import { useReportDetailI18n } from "@/pages/spaces/[spaceId]/report/[reportId]/i18n";
import { ACTION_SOURCE_VARIANTS, actionSourceToken } from "./chart-figure-html";
import { useReportDetailContext } from "../hooks/use-report-detail";

// app/ratel/src/features/spaces/pages/report/views/detail/data_picker.rs
//
// Data picker modal — pick an analyze, then a source tab, then a specific
// item to insert as a chart block.

export function DataPicker() {
  const tr = useReportDetailI18n();
  const ctx = useReportDetailContext();
  const open = ctx.drawer === "DataPicker";
  const currentAnalyze = ctx.currentAnalyze();
  const currentItems = ctx.currentPickerItems();

  return (
    <div
      className="report-detail__picker-overlay"
      data-open={dataBool(open)}
      aria-hidden={dataBool(!open)}
      onClick={() => ctx.closeDrawer()}
    >
      <div className="report-detail__picker-panel" onClick={(e) => e.stopPropagation()}>
        <div className="report-detail__picker-head">
          <div className="report-detail__picker-title-col">
            <span className="report-detail__picker-eyebrow">{tr.pickerEyebrow}</span>
            <span className="report-detail__picker-title">{tr.pickerTitle}</span>
          </div>
          <button className="report-detail__picker-close" aria-label={tr.pickerCloseAria} onClick={() => ctx.closeDrawer()}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="report-detail__picker-analyze">
          <span className="report-detail__picker-label">{tr.pickerAnalyzeLabel}</span>
          <div className="report-detail__picker-analyze-list">
            {ctx.analyzes.map((analyze) => (
              <AnalyzeOption key={analyze.id} analyze={analyze} selected={analyze.id === ctx.pickerAnalyzeId} />
            ))}
          </div>
        </div>

        <div className="report-detail__picker-tabs" role="tablist">
          {ACTION_SOURCE_VARIANTS.map((src) => (
            <SourceTab key={actionSourceToken(src)} source={src} />
          ))}
        </div>

        <div className="report-detail__picker-items">
          {currentItems.length === 0 ? (
            <div className="report-detail__picker-empty">{tr.pickerEmpty}</div>
          ) : (
            currentItems.map((item) => (
              <ItemRow key={item.id} item={item} analyze={currentAnalyze} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function AnalyzeOption({ analyze, selected }: { analyze: Analyze; selected: boolean }) {
  const tr = useReportDetailI18n();
  const ctx = useReportDetailContext();
  const total = analyze.poll.length + analyze.quiz.length + analyze.discussion.length + analyze.follow.length;

  return (
    <button
      className="report-detail__picker-opt"
      aria-selected={dataBool(selected)}
      type="button"
      onClick={() => ctx.setPickerAnalyzeId(analyze.id)}
    >
      <div className="report-detail__picker-opt-name">{analyze.name}</div>
      <div className="report-detail__picker-opt-meta">
        {analyze.respondents} {tr.pickerRespondentsUnit} · {total} {tr.pickerItemsUnit}
      </div>
      {analyze.filters.length > 0 && (
        <div className="report-detail__xf-chips">
          {analyze.filters.map((chip, i) => (
            <ChipPill key={`${chip.source}-${chip.label}-${i}`} chip={chip} />
          ))}
        </div>
      )}
    </button>
  );
}

function ChipPill({ chip }: { chip: CrossFilterChip }) {
  const badge = sourceBadge(chip.source);
  return (
    <span className="report-detail__xf-chip" data-source={actionSourceToken(chip.source)}>
      <span className="report-detail__xf-chip-src">{badge}</span>
      <span className="report-detail__xf-chip-label">{chip.label}</span>
    </span>
  );
}

function sourceBadge(s: ActionSource): string {
  switch (s) {
    case "Poll":
      return "POLL";
    case "Quiz":
      return "QUIZ";
    case "Discussion":
      return "DISCUSSION";
    case "Follow":
      return "FOLLOW";
  }
}

function SourceTab({ source }: { source: ActionSource }) {
  const tr = useReportDetailI18n();
  const ctx = useReportDetailContext();
  const label =
    source === "Poll"
      ? tr.pickerTabPoll
      : source === "Quiz"
        ? tr.pickerTabQuiz
        : source === "Discussion"
          ? tr.pickerTabDiscussion
          : tr.pickerTabFollow;
  const count = ctx.pickerItemsCountFor(source);

  return (
    <button
      className="report-detail__picker-tab"
      data-source={actionSourceToken(source)}
      aria-selected={dataBool(ctx.pickerSource === source)}
      disabled={count === 0}
      type="button"
      onClick={() => ctx.setPickerSource(source)}
    >
      <span className="report-detail__picker-tab-label">{label}</span>
      <span className="report-detail__picker-tab-count"> · {count}</span>
    </button>
  );
}

function ItemRow({ item, analyze }: { item: AnalyzeItem; analyze: Analyze | undefined }) {
  const ctx = useReportDetailContext();
  return (
    <button
      className="report-detail__picker-item"
      type="button"
      onClick={() => {
        if (analyze) {
          // The picker's source tab decides which aggregate bucket the item
          // lives in — pass that source down so the inserted figure is keyed
          // to the right surface (drives badge color + chart-type swap).
          ctx.insertChartFromPicker(analyze, item, ctx.pickerSource);
        } else {
          ctx.closeDrawer();
        }
      }}
    >
      <div className="report-detail__picker-item-title">{item.title}</div>
      <div className="report-detail__picker-item-meta">{item.meta}</div>
    </button>
  );
}
