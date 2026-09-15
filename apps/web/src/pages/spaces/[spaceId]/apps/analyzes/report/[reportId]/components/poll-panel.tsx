import type { PollQuestionAggregate } from "@ratel/ts-bridges";
import { useSpaceAnalyzesAppI18n } from "@/pages/spaces/[spaceId]/apps/analyzes/space-analyzes-app.i18n";
import { useAnalyzeReportDetailContext } from "../hooks/use-analyze-report-detail";

// app/ratel/src/features/spaces/pages/apps/apps/analyzes/views/report/poll_panel/component.rs

/** One bar-row inside a poll/quiz card (`BarItem`). */
export interface BarItem {
  label: string;
  value: string;
  width: string;
  color: string;
  group: string;
  groupLabel: string;
  filterValue: string;
  correct: boolean;
  correctText: boolean;
}

/** Stable rotation of bar colors (`--c1`..`--c5`). */
export const BAR_COLORS = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)"];

export function PollPanel() {
  const tr = useSpaceAnalyzesAppI18n();
  const ctrl = useAnalyzeReportDetailContext();
  const detail = ctrl.detail;
  const all = detail.result?.poll_aggregates ?? [];

  const activePollId = ctrl.selectedPoll ?? all[0]?.poll_id ?? null;
  const aggregates = activePollId === null ? [] : all.filter((q) => q.poll_id === activePollId);
  const exportDisabled = activePollId === null || ctrl.exportPending;

  const firstTitle = aggregates[0]?.poll_title;
  const filterTitle = detail.report.filters.find((f) => f.source === "poll")?.question_title;
  const panelTitle =
    firstTitle !== undefined && firstTitle.trim() !== ""
      ? firstTitle
      : filterTitle !== undefined && filterTitle.trim() !== ""
        ? filterTitle
        : tr.detailPanelChipPoll;

  return (
    <section className="panel" data-panel="poll" data-active="true">
      <div className="panel-toolbar">
        <button
          className="btn btn--primary panel-toolbar__action"
          type="button"
          disabled={exportDisabled}
          onClick={() => {
            if (activePollId !== null) ctrl.handleExportExcel(activePollId);
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {tr.downloadExcel}
        </button>
      </div>
      <h1 className="main-title">
        <span className="main-title__chip main-title__chip--poll">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          {tr.detailPanelChipPoll}
        </span>
        <span data-poll-title="true">{panelTitle}</span>
      </h1>

      {aggregates.length === 0 ? (
        <section className="card">
          <div className="card__head">
            <div className="card__title">{tr.detailPanelEmptyTitle}</div>
          </div>
          <div className="card__hint">{tr.detailPanelEmptyPoll}</div>
        </section>
      ) : (
        aggregates.map((q, qIdx) => <PollQuestionCard key={`poll-q-${qIdx}-${q.poll_id}`} question={q} />)
      )}
    </section>
  );
}

function PollQuestionCard({ question }: { question: PollQuestionAggregate }) {
  const tr = useSpaceAnalyzesAppI18n();
  const total = Math.max(question.respondent_count, 1);
  const groupId = `poll-q-${question.poll_id}-${question.question_idx}`;

  const bars: BarItem[] = question.options.map((opt, idx) => {
    const pct = Math.min(Math.max((opt.count / total) * 100, 0), 100);
    return {
      label: String(idx + 1),
      value: `${opt.label} · ${opt.count} (${pct.toFixed(1)}%)`,
      width: `${pct.toFixed(1)}%`,
      color: BAR_COLORS[idx % BAR_COLORS.length],
      group: groupId,
      groupLabel: question.question_title,
      filterValue: opt.label,
      correct: false,
      correctText: false,
    };
  });

  return (
    <section className="card">
      <div className="card__head">
        <div className="card__title">{question.question_title}</div>
        <span className="card__count">{`${question.respondent_count}명 ${tr.detailResponsesUnit}`}</span>
      </div>
      {bars.length === 0 ? (
        question.text_answers.length === 0 ? (
          <div className="card__hint">{tr.detailPanelEmptyTextAnswers}</div>
        ) : (
          <div className="text-list">
            {question.text_answers.map((txt, idx) => (
              <div key={`txt-${idx}`} className="text-item">
                {txt}
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="bar-chart">
          {bars.map((item, idx) => (
            <BarRow key={`${groupId}-${idx}`} source="poll" item={item} />
          ))}
        </div>
      )}
    </section>
  );
}

export function BarRow({ source, item }: { source: string; item: BarItem }) {
  return (
    <button
      className="bar-row"
      type="button"
      aria-pressed="false"
      data-correct={item.correct ? "true" : "false"}
      data-filter-source={source}
      data-filter-group={item.group}
      data-filter-group-label={item.groupLabel}
      data-filter-value={item.filterValue}
    >
      <span className="bar-row__label">{item.label}</span>
      <div className="bar-row__track">
        <div className="bar-row__fill" style={{ width: item.width, background: item.color }} />
      </div>
      <span className="bar-row__value">
        {item.correctText && <span className="bar-row__check">✓</span>}
        {item.value}
      </span>
    </button>
  );
}
