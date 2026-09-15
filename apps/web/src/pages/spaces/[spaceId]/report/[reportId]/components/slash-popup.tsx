import type { CSSProperties } from "react";
import { dataBool } from "@/lib/dom";
import { useReportDetailI18n } from "@/pages/spaces/[spaceId]/report/[reportId]/i18n";
import { actionSourceToken } from "./chart-figure-html";
import { useReportDetailContext, type SlashOption } from "../hooks/use-report-detail";

// app/ratel/src/features/spaces/pages/report/views/detail/slash_popup.rs
//
// 4-level slash autocomplete popup — `/data` → `:analyze` → `:source` →
// `:item`. Pure consumer: the option list and apply logic both live on the
// report-detail hook, so keyboard navigation (wired through
// `detail_actions.js`'s command bridge) and mouse clicks here stay in sync.

export function SlashPopup() {
  const tr = useReportDetailI18n();
  const ctx = useReportDetailContext();
  const state = ctx.slash;
  if (!state) return null;

  const heading =
    state.level === 0
      ? tr.slashHeadingCommand
      : state.level === 1
        ? tr.slashHeadingAnalyze
        : state.level === 2
          ? tr.slashHeadingDataSource
          : tr.slashHeadingItems;

  // Coordinates come from the editor's slash watcher and are viewport-
  // relative. The popup is positioned `fixed` so no scroll-offset math is
  // needed. For `placement = "above"` it's translated up by its own height
  // via `translateY(-100%)` so the caller doesn't need to know the rendered
  // popup height ahead of time.
  const style: CSSProperties =
    state.placement === "above"
      ? { position: "fixed", top: state.caretY, left: state.caretX, transform: "translateY(-100%)" }
      : { position: "fixed", top: state.caretY, left: state.caretX };

  const options = ctx.slashOptions;
  const selected = state.selectedIndex;

  return (
    <div className="report-detail__slash-pop" data-placement={state.placement} role="listbox" style={style}>
      <div className="report-detail__slash-pop-head">
        <span className="report-detail__slash-pop-heading">{heading}</span>
        <span className="report-detail__slash-pop-hint">{tr.slashPopHint}</span>
      </div>
      <div className="report-detail__slash-pop-list">
        {options.length === 0 ? (
          <div className="report-detail__slash-pop-empty">{tr.slashPopEmpty}</div>
        ) : (
          options.map((opt, i) => <SlashItem key={opt.id} opt={opt} selected={i === selected} />)
        )}
      </div>
    </div>
  );
}

function SlashItem({ opt, selected }: { opt: SlashOption; selected: boolean }) {
  const ctx = useReportDetailContext();
  return (
    <button
      className="report-detail__slash-item"
      aria-selected={dataBool(selected)}
      type="button"
      // `mousedown` (not click) so the focused contenteditable doesn't lose
      // its selection before the handler runs.
      onMouseDown={(e) => {
        e.preventDefault();
        ctx.applySlashAction(opt.action);
      }}
    >
      <span className="report-detail__slash-item-title">{opt.title}</span>
      <span className="report-detail__slash-item-meta">{opt.meta}</span>
      {opt.filters.length > 0 && (
        <div className="report-detail__xf-chips report-detail__xf-chips--slash">
          {opt.filters.map((chip, i) => (
            <span key={`${chip.source}-${chip.label}-${i}`} className="report-detail__xf-chip" data-source={actionSourceToken(chip.source)}>
              <span className="report-detail__xf-chip-src">{slashSrcLabel(chip.source)}</span>
              <span className="report-detail__xf-chip-label">{chip.label}</span>
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

function slashSrcLabel(s: SlashOption["filters"][number]["source"]): string {
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
