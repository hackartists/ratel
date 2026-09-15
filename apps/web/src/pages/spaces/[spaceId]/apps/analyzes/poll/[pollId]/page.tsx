import { Fragment, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { PollResultResponse, PollResultSummary, Question } from "@ratel/ts-bridges";
import { useSpaceAppsContext } from "@/layouts/space-apps-layout";
import {
  useSpaceAnalyzesAppI18n,
  type SpaceAnalyzesAppI18n,
} from "@/pages/spaces/[spaceId]/apps/analyzes/space-analyzes-app.i18n";
import { dataBool } from "@/lib/dom";
import { humanizeGroupValue, questionTitle } from "@/components/analyzes/analyze-excel";
import { useSpaceAnalyzePoll } from "./hooks/use-space-analyze-poll";

// app/ratel/src/features/spaces/pages/apps/apps/analyzes/views/analyze/poll/page.rs
// (`SpaceAnalyzeDetailPage`). Creator-only poll analysis arena: filter bar
// (group + value), one card per question (bar + conic-gradient pie, or a text
// response list) and the Excel export.

/** Chart palette. MUST stay in sync with `--sap-c1`..`--sap-c6` in main.css. */
const ANALYZE_CHART_COLORS = ["#f97316", "#6366f1", "#22c55e", "#3b82f6", "#8b5cf6", "#eab308"];
const DEFAULT_SPACE_LOGO = "https://metadata.ratel.foundation/logos/logo-symbol.png";

interface AnalyzeFilterOption {
  key: string;
  label: string;
}

interface AnalyzeChoiceStat {
  label: string;
  optionText: string;
  count: number;
  percentage: number;
  barWidth: number;
  color: string;
}

export function Component() {
  const { spaceId = "", pollId = "" } = useParams();
  const { role } = useSpaceAppsContext();

  if (role !== "Creator") {
    return (
      <div className="sap-arena">
        <div className="sap-viewer-empty">Creator access only.</div>
      </div>
    );
  }
  return <PollAnalyzeArena spaceId={spaceId} pollId={pollId} />;
}

function PollAnalyzeArena({ spaceId, pollId }: { spaceId: string; pollId: string }) {
  const tr = useSpaceAnalyzesAppI18n();
  const { space } = useSpaceAppsContext();
  const navigate = useNavigate();
  const ctrl = useSpaceAnalyzePoll(spaceId, pollId);
  const { poll, result } = ctrl;

  const filterGroups = buildFilterGroupOptions(result, tr);
  const activeGroup = activeFilterGroup(filterGroups, ctrl.selectedFilterGroup);
  const filterValues = buildFilterValueOptions(result, activeGroup, tr);
  const activeValue = activeFilterValue(filterValues, ctrl.selectedFilterValue);
  const activeFilterKey = composeFilterKey(activeGroup, activeValue);
  const activeSummaries = selectSummaries(result, activeFilterKey);

  const spaceLogo = space.logo === "" ? DEFAULT_SPACE_LOGO : space.logo;

  const onGroupChange = (value: string) => {
    const nextValues = buildFilterValueOptions(result, value, tr);
    ctrl.setSelectedFilterGroup(value);
    ctrl.setSelectedFilterValue(nextValues[0]?.key ?? "");
  };

  return (
    <div className="sap-arena">
      <header className="sap-topbar" role="banner">
        <div className="sap-topbar__left">
          <button
            type="button"
            className="sap-back-btn"
            aria-label="Back"
            data-testid="topbar-back"
            onClick={() => navigate(-1)}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
          </button>
          <img className="sap-topbar__logo" alt="Space logo" src={spaceLogo} />
          {/* Breadcrumb labels are hardcoded in the Rust view as well. */}
          <nav className="sap-breadcrumb">
            <span className="sap-breadcrumb__item">{space.title}</span>
            <span className="sap-breadcrumb__sep">›</span>
            <span className="sap-breadcrumb__item">Apps</span>
            <span className="sap-breadcrumb__sep">›</span>
            <span className="sap-breadcrumb__item">Analyze</span>
            <span className="sap-breadcrumb__sep">›</span>
            <span className="sap-breadcrumb__item sap-breadcrumb__current">Poll</span>
          </nav>
          <span className="sap-type-badge" data-testid="type-badge">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 3v18h18" />
              <path d="M7 14l4-4 4 4 5-5" />
            </svg>
            Analyze
          </span>
          <span className="sap-topbar__title">{poll.title}</span>
        </div>

        <div className="sap-topbar__right">
          <button
            type="button"
            className="sap-btn sap-btn--primary sap-btn--lg"
            data-testid="export-excel-btn"
            disabled={ctrl.exportPending}
            onClick={ctrl.handleExportExcel}
          >
            <svg
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
      </header>

      <div className="sap-body">
        <div className="sap-filter-bar" data-testid="filter-bar">
          <ArenaFilterDropdown
            testid="filter-select"
            ariaLabel={tr.filterGroupLabel}
            selectedKey={activeGroup}
            options={filterGroups}
            onChange={onGroupChange}
          />
          {activeGroup !== "overall" && filterValues.length > 0 && (
            <ArenaFilterDropdown
              testid="filter-select-value"
              ariaLabel={tr.filterValueLabel}
              selectedKey={activeValue}
              options={filterValues}
              onChange={ctrl.setSelectedFilterValue}
            />
          )}
        </div>

        {poll.questions.map((question, idx) => {
          const summary = activeSummaries[idx];
          if (!summary) return null;
          return (
            <QuestionCard
              key={`analyze-question-${filterDomSuffix(activeFilterKey)}-${idx}`}
              question={question}
              summary={summary}
              tr={tr}
            />
          );
        })}
      </div>
    </div>
  );
}

/** `render_question_card` — objective (bar + pie) or subjective (text list). */
function QuestionCard({
  question,
  summary,
  tr,
}: {
  question: Question;
  summary: PollResultSummary;
  tr: SpaceAnalyzesAppI18n;
}) {
  const title = questionTitle(question);
  const responseUnit = tr.totalResponseCountUnit;

  if (summary.answer_type === "short_answer" || summary.answer_type === "subjective") {
    const responses = sortedTextAnswers(summary.answers);
    return (
      <section className="sap-q-card" data-testid="question-card-subjective">
        <div className="sap-q-card__head">
          <div className="sap-q-card__title">{title}</div>
          <span className="sap-q-card__count">{`${summary.total_count} ${responseUnit}`}</span>
        </div>
        {responses.length === 0 ? (
          <div className="sap-text-empty">{tr.noTextResponses}</div>
        ) : (
          <div className="sap-text-list" data-testid="text-response-list">
            {responses.map(([text, count], rowIdx) => (
              <div key={`text-response-${rowIdx}`} className="sap-text-item">
                {`${text} (${count})`}
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }

  const bars = buildChoiceStats(question, summary, tr.otherLabel);
  const pieGradient = buildPieGradient(bars);
  const total = summary.total_count;
  const hasPieData = bars.some((s) => s.count > 0);

  return (
    <section className="sap-q-card" data-testid="question-card-objective">
      <div className="sap-q-card__head">
        <div className="sap-q-card__title">{title}</div>
        <span className="sap-q-card__count">{`${total} ${responseUnit}`}</span>
      </div>

      <div className="sap-bar-chart" data-testid="bar-chart">
        {bars.map((stat, barIdx) => (
          <div key={`bar-${barIdx}`} className="sap-bar-row">
            <span className="sap-bar-row__label">{stat.label}</span>
            <div className="sap-bar-row__track">
              <div className="sap-bar-row__fill" style={{ width: `${stat.barWidth}%`, background: stat.color }} />
            </div>
            <span className="sap-bar-row__value">
              {`${stat.optionText} · ${stat.count} (${stat.percentage.toFixed(1)}%)`}
            </span>
          </div>
        ))}
      </div>

      {bars.length > 0 && hasPieData && (
        <div className="sap-pie-wrap" data-testid="pie-chart">
          <div className="sap-pie" role="img" aria-label={buildPieAriaLabel(bars)} style={{ background: pieGradient }}>
            <div className="sap-pie__labels">
              <div>
                <span className="sap-pie__label-line sap-pie__label-line--top">Total</span>
                <span className="sap-pie__label-line sap-pie__label-line--big">{String(total)}</span>
                <span className="sap-pie__label-line sap-pie__label-line--sub">{responseUnit}</span>
              </div>
            </div>
          </div>
          <div className="sap-pie-legend" aria-label="chart legend">
            {bars.map((stat, legendIdx) => (
              <div key={`legend-${legendIdx}`} className="sap-pie-legend__row">
                <span className="sap-pie-legend__swatch" style={{ background: stat.color }} />
                <span className="sap-pie-legend__label">{stat.optionText}</span>
                <span className="sap-pie-legend__value">{`${stat.percentage.toFixed(1)}%`}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ── Chart helpers ─────────────────────────────────────────────────

function buildPieGradient(bars: AnalyzeChoiceStat[]): string {
  if (bars.length === 0) return "";
  const stops: string[] = [];
  let cursor = 0;
  for (const stat of bars) {
    const next = cursor + (stat.percentage / 100) * 360;
    stops.push(`${stat.color} ${cursor.toFixed(4)}deg ${next.toFixed(4)}deg`);
    cursor = next;
  }
  return `conic-gradient(${stops.join(", ")})`;
}

function buildPieAriaLabel(bars: AnalyzeChoiceStat[]): string {
  return bars.map((s) => `${s.optionText} ${s.percentage.toFixed(1)}%`).join(", ");
}

function filterDomSuffix(key: string): string {
  return key.replace(/[^A-Za-z0-9]/g, "-");
}

// ── Filter builders ──────────────────────────────────────────────

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function hasKeys(map: Record<string, unknown>): boolean {
  return Object.keys(map).length > 0;
}

function buildFilterGroupOptions(result: PollResultResponse, tr: SpaceAnalyzesAppI18n): AnalyzeFilterOption[] {
  const options: AnalyzeFilterOption[] = [{ key: "overall", label: tr.filterAll }];
  if (hasKeys(result.summaries_by_gender)) options.push({ key: "gender", label: tr.filterGender });
  if (hasKeys(result.summaries_by_age)) options.push({ key: "age", label: tr.filterAge });
  if (hasKeys(result.summaries_by_school)) options.push({ key: "school", label: tr.filterSchool });
  return options;
}

function buildFilterValueOptions(
  result: PollResultResponse,
  group: string,
  tr: SpaceAnalyzesAppI18n,
): AnalyzeFilterOption[] {
  let values: AnalyzeFilterOption[];
  switch (group) {
    case "gender":
      values = Object.keys(result.summaries_by_gender).map((key) => ({ key, label: humanizeGroupValue(key, tr) }));
      break;
    case "age":
      values = Object.keys(result.summaries_by_age).map((key) => ({ key, label: key }));
      break;
    case "school":
      values = Object.keys(result.summaries_by_school).map((key) => ({ key, label: humanizeGroupValue(key, tr) }));
      break;
    default:
      values = [];
  }
  // Rust `sort_by` is stable, like `Array.prototype.sort`.
  values.sort((a, b) => cmp(a.label, b.label));
  return values;
}

function activeFilterGroup(options: AnalyzeFilterOption[], key: string): string {
  return options.find((o) => o.key === key)?.key ?? "overall";
}

function activeFilterValue(options: AnalyzeFilterOption[], key: string): string {
  return options.find((o) => o.key === key)?.key ?? options[0]?.key ?? "";
}

function composeFilterKey(group: string, value: string): string {
  return group === "overall" || value === "" ? "overall" : `${group}:${value}`;
}

function selectSummaries(result: PollResultResponse, key: string): PollResultSummary[] {
  if (key.startsWith("gender:")) return result.summaries_by_gender[key.slice(7)] ?? result.summaries;
  if (key.startsWith("age:")) return result.summaries_by_age[key.slice(4)] ?? result.summaries;
  if (key.startsWith("school:")) return result.summaries_by_school[key.slice(7)] ?? result.summaries;
  return result.summaries;
}

function buildChoiceStats(question: Question, summary: PollResultSummary, otherLabel: string): AnalyzeChoiceStat[] {
  const stats = buildChoiceStatsRaw(question, summary, otherLabel);
  const total = stats.reduce((sum, s) => sum + s.count, 0);
  for (const s of stats) s.percentage = total > 0 ? (s.count / total) * 100 : 0;
  const max = stats.reduce((m, s) => Math.max(m, s.count), 0);
  if (max > 0) for (const s of stats) s.barWidth = (s.count / max) * 100;
  return stats;
}

function buildChoiceStat(label: string, optionText: string, count: number, totalCount: number, index: number) {
  return {
    label,
    optionText,
    count,
    percentage: totalCount > 0 ? (count / totalCount) * 100 : 0,
    barWidth: 0,
    color: ANALYZE_CHART_COLORS[index % ANALYZE_CHART_COLORS.length],
  };
}

function optionStats(options: string[], answers: Record<string, number | undefined>, totalCount: number) {
  return options.map((text, idx) => buildChoiceStat(String(idx + 1), text, answers[String(idx)] ?? 0, totalCount, idx));
}

function buildChoiceStatsRaw(question: Question, summary: PollResultSummary, otherLabel: string): AnalyzeChoiceStat[] {
  const q = question.answer_type;
  const s = summary.answer_type;
  if (
    (q === "single_choice" || q === "multiple_choice") &&
    "options" in question &&
    (s === "single_choice" || s === "multiple_choice")
  ) {
    const stats = optionStats(question.options, summary.answers, summary.total_count);
    if ("allow_other" in question && question.allow_other) {
      const count = Object.values(summary.other_answers).reduce<number>((sum, v) => sum + (v ?? 0), 0);
      stats.push(
        buildChoiceStat(
          String(question.options.length + 1),
          otherLabel,
          count,
          summary.total_count,
          question.options.length,
        ),
      );
    }
    return stats;
  }
  if (question.answer_type === "checkbox" && summary.answer_type === "checkbox") {
    return optionStats(question.options, summary.answers, summary.total_count);
  }
  if (question.answer_type === "dropdown" && summary.answer_type === "dropdown") {
    return optionStats(question.options, summary.answers, summary.total_count);
  }
  if (question.answer_type === "linear_scale" && summary.answer_type === "linear_scale") {
    const out: AnalyzeChoiceStat[] = [];
    for (let value = question.min_value, idx = 0; value <= question.max_value; value++, idx++) {
      const label = String(value);
      out.push(buildChoiceStat(label, label, summary.answers[label] ?? 0, summary.total_count, idx));
    }
    return out;
  }
  return [];
}

function sortedTextAnswers(answers: Record<string, number | undefined>): [string, number][] {
  const items: [string, number][] = [];
  for (const [text, count] of Object.entries(answers)) {
    const trimmed = text.trim();
    if (trimmed !== "") items.push([trimmed, count ?? 0]);
  }
  items.sort((l, r) => r[1] - l[1] || cmp(l[0].toLowerCase(), r[0].toLowerCase()));
  return items;
}

// ── Arena filter dropdown ─────────────────────────────────────────

function ArenaFilterDropdown({
  testid,
  ariaLabel,
  selectedKey,
  options,
  onChange,
}: {
  testid: string;
  ariaLabel: string;
  selectedKey: string;
  options: AnalyzeFilterOption[];
  onChange: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((o) => o.key === selectedKey)?.label ?? "";

  return (
    <div className="sap-filter-dropdown">
      <button
        type="button"
        className="sap-filter-trigger"
        data-testid={testid}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={dataBool(open)}
        onClick={() => setOpen(!open)}
      >
        <span className="sap-filter-trigger__label">{selectedLabel}</span>
        <svg
          className="sap-filter-trigger__chevron"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <Fragment>
          <div className="sap-filter-backdrop" onClick={() => setOpen(false)} />
          <div className="sap-filter-panel" role="listbox">
            {options.map((option) => {
              const selected = option.key === selectedKey;
              return (
                <button
                  key={option.key}
                  type="button"
                  className="sap-filter-option"
                  role="option"
                  aria-selected={dataBool(selected)}
                  data-selected={dataBool(selected)}
                  onClick={() => {
                    setOpen(false);
                    onChange(option.key);
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </Fragment>
      )}
    </div>
  );
}
