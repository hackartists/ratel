import type { QuizQuestionAggregate } from "@ratel/ts-bridges";
import { useSpaceAnalyzesAppI18n } from "@/pages/spaces/[spaceId]/apps/analyzes/space-analyzes-app.i18n";
import { useAnalyzeReportDetailContext } from "../hooks/use-analyze-report-detail";
import { ReanalyzeButton } from "./reanalyze-button";
import { BAR_COLORS, BarRow, type BarItem } from "./poll-panel";

// app/ratel/src/features/spaces/pages/apps/apps/analyzes/views/report/quiz_panel/component.rs

export function QuizPanel() {
  const tr = useSpaceAnalyzesAppI18n();
  const ctrl = useAnalyzeReportDetailContext();
  const detail = ctrl.detail;
  const all = detail.result?.quiz_aggregates ?? [];

  const activeQuizId = ctrl.selectedQuiz ?? all[0]?.quiz_id ?? null;
  const aggregates = activeQuizId === null ? [] : all.filter((q) => q.quiz_id === activeQuizId);

  const firstTitle = aggregates[0]?.quiz_title;
  const filterTitle = detail.report.filters.find((f) => f.source === "quiz")?.question_title;
  const panelTitle =
    firstTitle !== undefined && firstTitle.trim() !== ""
      ? firstTitle
      : filterTitle !== undefined && filterTitle.trim() !== ""
        ? filterTitle
        : tr.detailPanelChipQuiz;

  return (
    <section className="panel" data-panel="quiz" data-active="false">
      <div className="panel-toolbar">
        <ReanalyzeButton className="panel-toolbar__action" />
      </div>
      <h1 className="main-title">
        <span className="main-title__chip main-title__chip--quiz">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M9 9a3 3 0 0 1 6 0c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          {tr.detailPanelChipQuiz}
        </span>
        <span data-quiz-title="true">{panelTitle}</span>
      </h1>

      {aggregates.length === 0 ? (
        <section className="card">
          <div className="card__head">
            <div className="card__title">{tr.detailPanelEmptyTitle}</div>
          </div>
          <div className="card__hint">{tr.detailPanelEmptyQuiz}</div>
        </section>
      ) : (
        aggregates.map((q, qIdx) => <QuizQuestionCard key={`quiz-q-${qIdx}-${q.quiz_id}`} question={q} />)
      )}
    </section>
  );
}

function QuizQuestionCard({ question }: { question: QuizQuestionAggregate }) {
  const tr = useSpaceAnalyzesAppI18n();
  const total = Math.max(question.respondent_count, 1);
  const groupId = `quiz-q-${question.quiz_id}-${question.question_idx}`;
  const correctSet = new Set(question.correct_indices);
  const correctPct =
    question.respondent_count === 0 ? 0 : Math.round((question.correct_count / question.respondent_count) * 100);

  const bars: BarItem[] = question.options.map((opt, idx) => {
    const pct = Math.min(Math.max((opt.count / total) * 100, 0), 100);
    const isCorrect = correctSet.has(idx);
    const suffix = isCorrect ? ` · ${tr.createSunjiCorrectBadge}` : "";
    return {
      label: String(idx + 1),
      value: `${opt.label} · ${opt.count} (${pct.toFixed(1)}%)${suffix}`,
      width: `${pct.toFixed(1)}%`,
      color: isCorrect ? "var(--quiz-correct)" : BAR_COLORS[idx % BAR_COLORS.length],
      group: groupId,
      groupLabel: question.question_title,
      filterValue: opt.label,
      correct: isCorrect,
      correctText: isCorrect,
    };
  });

  return (
    <section className="card">
      <div className="card__head">
        <div className="card__title">{question.question_title}</div>
        <span className="card__count">
          {`${question.respondent_count}명 ${tr.detailAttemptsUnit} · ${tr.detailCorrectRatePrefix} ${correctPct}%`}
        </span>
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
            <BarRow key={`${groupId}-${idx}`} source="quiz" item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
