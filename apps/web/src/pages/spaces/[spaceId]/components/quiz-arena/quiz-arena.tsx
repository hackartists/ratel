// app/ratel/src/features/spaces/pages/index/action_pages/quiz/component.rs:37-481 —
// `QuizArenaPage`: the full-screen quiz overlay opened from the action
// dashboard (overview screen → question solving → submit).
//
// `SpaceIndexPage` mounts it inside
// `<div className="fixed inset-0 z-[100]" data-testid="quiz-arena-overlay"><Suspense fallback={null}>`,
// so this component renders only `.quiz-arena` and suspends on the quiz loader.
import { useMemo, useState } from "react";
import type { Answer } from "@ratel/ts-bridges";
import { useRespondQuiz } from "@ratel/ts-bridges/hooks";
import { canExecuteSpaceAction, isParticipationOpen } from "@/components/space/access";
import { useActionOverlay, useCompletedActionCard } from "@/components/space/action-overlay";
import { useActionExecuteRole, useSpace, useSpaceContext } from "@/components/space/space-context";
import { useQuizArenaI18n } from "./i18n";
import { useToast } from "@/lib/toast";
import { useQuiz } from "./hooks/use-quiz";
import { QuestionCardView } from "./question-card-view";
import { RING_CIRCUMFERENCE, defaultAnswer, formatF64, hasAnswer } from "./quiz-helpers";

type QuizStep = "Overview" | "Quiz";

export function QuizArenaPage({ spaceId, quizId }: { spaceId: string; quizId: string }) {
  const tr = useQuizArenaI18n();
  const toast = useToast();
  const spaceCtx = useSpaceContext();
  const role = useActionExecuteRole();
  const space = useSpace();

  const { quiz, restart: restartQuiz } = useQuiz(spaceId, quizId);
  const questions = quiz.questions;

  const totalQuestions = questions.length;
  const totalAllowed = quiz.retry_count + 1;
  const remaining = Math.max(0, totalAllowed - quiz.attempt_count);
  const hasPassed = quiz.passed ?? false;
  const actionStatus = quiz.space_action.status;
  const isInProgress = actionStatus === "Ongoing";
  // Candidates must be allowed through here so they can take a prerequisite
  // quiz before the space starts. The actual role+prerequisite+status gate
  // below (`canExecute`) still blocks non-prerequisite quizzes / Viewers.
  const canRespond = role === "Creator" || role === "Participant" || role === "Candidate";
  const canExecute = canExecuteSpaceAction(
    role,
    quiz.space_action.prerequisite,
    space.status,
    actionStatus,
    true,
    isParticipationOpen(space),
  );
  // "Not started yet" — same condition that drives the `quiz_not_started`
  // banner. The begin/review button is disabled in this state; it stays
  // enabled when ended/passed so users can still review a completed quiz.
  const isFinished = actionStatus === "Finish";
  const isNotStarted = !isInProgress && !isFinished;
  const acceptsResponses = isInProgress || (role === "Creator" && isNotStarted);
  const canSubmit = canRespond && canExecute && acceptsResponses && !hasPassed && quiz.attempt_count < totalAllowed;
  const passPct = totalQuestions > 0 ? Math.trunc((quiz.pass_score / totalQuestions) * 100.0) : 0;

  const [step, setStep] = useState<QuizStep>("Overview");
  const [questionIndex, setQuestionIndex] = useState(0);
  // Rust `use_signal(|| initial_answers)` — seeded once on mount.
  const [answers, setAnswers] = useState<Answer[]>(() => quiz.my_response ?? questions.map(defaultAnswer));

  const answeredCount = useMemo(
    () => questions.filter((q, i) => hasAnswer(q, answers[i])).length,
    [questions, answers],
  );
  const allAnswered = totalQuestions === 0 ? false : answeredCount === totalQuestions;
  const ringOffset =
    totalQuestions === 0 ? RING_CIRCUMFERENCE : RING_CIRCUMFERENCE - (answeredCount / totalQuestions) * RING_CIRCUMFERENCE;

  const overlay = useActionOverlay();
  const completed = useCompletedActionCard();
  const respondQuiz = useRespondQuiz();

  const closeOverlay = () => overlay.setOverlay(null);

  const onBack = () => {
    if (step === "Quiz" && questionIndex === 0) {
      setStep("Overview");
    } else {
      closeOverlay();
    }
  };

  const onSubmit = async () => {
    const req = { answers };
    try {
      await respondQuiz.mutateAsync({ spacePk: spaceId, quizId, req });
    } catch (err) {
      console.error("Failed to submit quiz:", err);
      toast.error(err);
      return;
    }
    void restartQuiz();
    void spaceCtx.restartRanking();
    void spaceCtx.restartMyScore();
    // Restart actions list so dashboard refreshes after animation
    void spaceCtx.restartActions();
    toast.info(tr.submitSuccess);
    // Signal the dashboard to animate this card into archive
    completed.setCompleted(quizId);
    closeOverlay();
  };

  const idx = Math.min(questionIndex, Math.max(0, totalQuestions - 1));
  const currentQuestion = questions[idx];
  const correctAnswer = quiz.correct_answers?.[idx] ?? null;

  return (
    <div className="quiz-arena">
      {/* ── Top bar ────────────────────────────── */}
      <div className="quiz-topbar">
        <div className="quiz-topbar__left">
          <button className="quiz-topbar__back" data-testid="quiz-arena-back" onClick={onBack}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5" />
              <path d="m12 19-7-7 7-7" />
            </svg>
          </button>
          <span className="quiz-topbar__title">{quiz.title}</span>
          <span className="quiz-topbar__badge">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            {tr.quizLabel}
          </span>
        </div>
        <div className="quiz-topbar__right">
          {step === "Quiz" && (
            <div className="progress-ring">
              <svg className="progress-ring__svg" viewBox="0 0 48 48">
                <circle className="progress-ring__bg" cx="24" cy="24" r="20" />
                <circle
                  className="progress-ring__fill"
                  cx="24"
                  cy="24"
                  r="20"
                  strokeDasharray={formatF64(RING_CIRCUMFERENCE)}
                  strokeDashoffset={formatF64(ringOffset)}
                />
              </svg>
              <div className="progress-ring__label">{`${answeredCount}/${totalQuestions}`}</div>
            </div>
          )}
          <div className="attempts-chip">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 16h5v5" />
            </svg>
            <span>{`${remaining} / ${totalAllowed} ${tr.attemptsLeft}`}</span>
          </div>
        </div>
      </div>

      {/* ── Banners ────────────────────────────── */}
      {isFinished && <div className="quiz-banner quiz-banner--warning">{tr.quizEnded}</div>}
      {!isInProgress && !isFinished && <div className="quiz-banner quiz-banner--info">{tr.quizNotStarted}</div>}
      {/* Viewer role, space is Processing/Finished, or prerequisite missing →
          permission banner. `canExecute` already folds in space status +
          prerequisite + join_anytime. */}
      {isInProgress && (!canRespond || !canExecute) && (
        <div className="quiz-banner quiz-banner--warning">{tr.noPermission}</div>
      )}
      {isInProgress && hasPassed && <div className="quiz-banner quiz-banner--success">{tr.alreadyPassed}</div>}
      {isInProgress && !hasPassed && quiz.attempt_count >= totalAllowed && canRespond && (
        <div className="quiz-banner quiz-banner--warning">{tr.noRemainingAttempts}</div>
      )}

      {/* ── SCREEN 1: Overview ─────────────────── */}
      {step === "Overview" && (
        <div className="quiz-overview" data-testid="quiz-arena-overview">
          <div className="overview-ring">
            <svg className="overview-ring__svg" viewBox="0 0 140 140">
              <circle className="overview-ring__bg" cx="70" cy="70" r="60" />
              <circle
                className="overview-ring__fill"
                cx="70"
                cy="70"
                r="60"
                strokeDasharray="376.99"
                strokeDashoffset="0"
              />
            </svg>
            <div className="overview-ring__center">
              <span className="overview-ring__number">{totalQuestions}</span>
              <span className="overview-ring__label">{tr.questionsLabel}</span>
            </div>
          </div>

          <div className="overview-card">
            <div className="overview-card__title">{quiz.title}</div>
            {quiz.description !== "" && (
              <div className="overview-card__desc" dangerouslySetInnerHTML={{ __html: quiz.description }} />
            )}

            <div className="overview-stats">
              <div className="overview-stat">
                <span className="overview-stat__value">{totalQuestions}</span>
                <span className="overview-stat__label">{tr.questionsLabel}</span>
              </div>
              <div className="overview-stat">
                <span className="overview-stat__value">{`${passPct}%`}</span>
                <span className="overview-stat__label">{tr.passScoreLabel}</span>
              </div>
              <div className="overview-stat">
                <span className="overview-stat__value">{quiz.space_action.credits}</span>
                <span className="overview-stat__label">{tr.creditsLabel}</span>
              </div>
            </div>

            {quiz.files.length > 0 && (
              <div className="overview-files">
                {quiz.files.map((file) => (
                  <a
                    className="overview-file"
                    key={file.id}
                    href={file.url ?? ""}
                    target="_blank"
                    download={file.name}
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
                    {file.name}
                  </a>
                ))}
              </div>
            )}

            <button
              className="quiz-begin-btn"
              data-testid="quiz-arena-begin"
              disabled={totalQuestions === 0 || (isNotStarted && !acceptsResponses)}
              onClick={() => {
                setQuestionIndex(0);
                setStep("Quiz");
              }}
            >
              {canSubmit ? tr.beginQuiz : tr.reviewQuiz}
            </button>
          </div>
        </div>
      )}

      {/* ── SCREEN 2: Question solving ─────────── */}
      {step === "Quiz" && (
        <>
          <div className="quiz-question-area" data-testid="quiz-arena-questions">
            {currentQuestion !== undefined && (
              <QuestionCardView
                key={idx}
                index={idx}
                total={totalQuestions}
                question={currentQuestion}
                answer={answers[idx] ?? null}
                correctAnswer={correctAnswer}
                disabled={!canSubmit}
                onChange={(nextAnswer) => {
                  setAnswers((prev) => {
                    const next = [...prev];
                    if (idx < next.length) {
                      next[idx] = nextAnswer;
                    }
                    return next;
                  });
                }}
              />
            )}
          </div>

          {/* ── Bottom bar ───────────────────── */}
          <div className="quiz-bottom">
            <div className="quiz-bottom__left">
              <div className="question-dots">
                {questions.map((q, i) => (
                  <div
                    key={`dot-${i}`}
                    className={
                      i === questionIndex
                        ? "question-dot question-dot--current"
                        : hasAnswer(q, answers[i])
                          ? "question-dot question-dot--answered"
                          : "question-dot"
                    }
                  />
                ))}
              </div>
            </div>
            <div className="quiz-bottom__right">
              {questionIndex > 0 && (
                <button
                  className="quiz-nav-btn"
                  data-testid="quiz-arena-prev"
                  onClick={() => {
                    if (questionIndex > 0) setQuestionIndex(questionIndex - 1);
                  }}
                >
                  {tr.btnBack}
                </button>
              )}

              {questionIndex + 1 < totalQuestions && (
                <button
                  className="quiz-nav-btn quiz-nav-btn--primary"
                  data-testid="quiz-arena-next"
                  onClick={() => {
                    if (questionIndex + 1 < totalQuestions) setQuestionIndex(questionIndex + 1);
                  }}
                >
                  {tr.btnNext}
                </button>
              )}

              {questionIndex + 1 >= totalQuestions && (
                <button
                  className="quiz-nav-btn quiz-nav-btn--submit"
                  data-testid="quiz-arena-submit"
                  disabled={!canSubmit || !allAnswered}
                  onClick={() => void onSubmit()}
                >
                  {tr.btnSubmit}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
