import type { Question } from "@ratel/ts-bridges";
import { useSpaceAnalyzesAppI18n } from "@/i18n/generated/features/spaces/pages/apps/apps/analyzes/space-analyzes-app.i18n";
import { badge, correctIndicesFor, optionsOf, useAnalyzeCreateContext } from "../hooks/use-analyze-create";

// app/ratel/src/features/spaces/pages/apps/apps/analyzes/views/create/cf_sunji/component.rs
// cf-sunji card: poll/quiz question+option checkboxes (quiz marks correct
// options), discussion keyword input, or the flat follow-target list.

export function CfSunjiCard() {
  const tr = useSpaceAnalyzesAppI18n();
  const ctrl = useAnalyzeCreateContext();
  const { pickingType: src, pickedItemId: itemId } = ctrl;

  if (itemId === null || src === null) {
    return <section className="cf-sunji" id="cf-sunji" hidden />;
  }

  const titleText =
    src === "follow"
      ? tr.createSunjiFollowTitle
      : ctrl.pickedItemTitle === ""
        ? tr.createSunjiDefaultTitle
        : ctrl.pickedItemTitle;

  const hasKw =
    src === "discussion" &&
    ctrl.keywordInput
      .split(",")
      .map((s) => s.trim())
      .some((s) => s !== "");
  const confirmDisabled = !(ctrl.pickedSunji.size > 0 || hasKw);

  return (
    <section className="cf-sunji" id="cf-sunji">
      <header className="cf-sunji__head">
        <span className="cf-sunji__type-chip" id="cf-sunji-type" data-source={src}>
          {badge(src)}
        </span>
        <span className="cf-sunji__title" id="cf-sunji-title">
          {titleText}
        </span>
        <button
          type="button"
          className="cross-filter__pick-cancel"
          id="cf-sunji-back"
          data-testid="cf-sunji-back"
          onClick={() => (src === "follow" ? ctrl.backToAction() : ctrl.clearItem())}
        >
          {tr.createSunjiBack}
        </button>
      </header>

      <div className="cf-sunji__list" id="cf-sunji-list">
        {src === "discussion" ? (
          <KeywordBlock />
        ) : src === "follow" ? (
          <FollowTargetsBlock />
        ) : src === "poll" ? (
          <QuestionsBlock
            questions={ctrl.selectedPoll?.questions ?? []}
            loading={ctrl.selectedPollLoading}
            correctFor={() => []}
          />
        ) : (
          <QuestionsBlock
            questions={ctrl.selectedQuiz?.questions ?? []}
            loading={ctrl.selectedQuizLoading}
            correctFor={(qIdx) => {
              const answer = (ctrl.selectedQuiz?.correct_answers ?? [])[qIdx];
              return answer === undefined ? [] : (correctIndicesFor(answer) ?? []);
            }}
          />
        )}
      </div>

      <div className="cf-sunji__foot">
        <button
          type="button"
          className="btn btn--primary"
          id="cf-sunji-confirm"
          data-testid="cf-sunji-confirm"
          disabled={confirmDisabled}
          onClick={ctrl.confirmSunji}
        >
          {tr.createSunjiConfirm}
        </button>
      </div>
    </section>
  );
}

/** `PollQuestionsBlock` / `QuizQuestionsBlock`. */
function QuestionsBlock({
  questions,
  loading,
  correctFor,
}: {
  questions: Question[];
  loading: boolean;
  correctFor: (qIdx: number) => number[];
}) {
  const tr = useSpaceAnalyzesAppI18n();
  if (questions.length === 0) {
    return (
      <div className="cross-filter__chips-empty" style={{ padding: "20px 4px" }}>
        {loading ? tr.createSunjiLoading : tr.createSunjiEmpty}
      </div>
    );
  }
  return (
    <>
      {questions.map((question, qIdx) => (
        <QuestionBlock key={`q-${qIdx}`} qIdx={qIdx} question={question} correctIndices={correctFor(qIdx)} />
      ))}
    </>
  );
}

function QuestionBlock({
  qIdx,
  question,
  correctIndices,
}: {
  qIdx: number;
  question: Question;
  correctIndices: number[];
}) {
  const options = optionsOf(question);
  // Questions without a finite option list can't drive a chip.
  if (options.length === 0) return null;
  return (
    <div className="cf-question">
      <div className="cf-question__title">{question.title}</div>
      <div className="cf-question__options">
        {options.map((label, oIdx) => (
          <QuestionOption
            key={`${qIdx}-${oIdx}`}
            token={`${qIdx}:${oIdx}`}
            label={label}
            correct={correctIndices.includes(oIdx)}
          />
        ))}
      </div>
    </div>
  );
}

function QuestionOption({ token, label, correct }: { token: string; label: string; correct: boolean }) {
  const tr = useSpaceAnalyzesAppI18n();
  const ctrl = useAnalyzeCreateContext();
  return (
    <label className="cf-option cf-option--inline">
      <input
        type="checkbox"
        data-sunji-id={token}
        checked={ctrl.pickedSunji.has(token)}
        onChange={() => ctrl.toggleSunji(token)}
      />
      <span className="cf-option__body">
        <span className="cf-option__title">{label}</span>
      </span>
      {correct && <span className="cf-option__correct">{tr.createSunjiCorrectBadge}</span>}
    </label>
  );
}

function FollowTargetsBlock() {
  const tr = useSpaceAnalyzesAppI18n();
  const ctrl = useAnalyzeCreateContext();
  const targets = ctrl.follows.items;

  if (targets.length === 0) {
    return (
      <div className="cross-filter__chips-empty" style={{ padding: "20px 4px" }}>
        {tr.createSunjiFollowEmpty}
      </div>
    );
  }

  return (
    <div className="cf-question">
      <div className="cf-question__title">{tr.createSunjiFollowTitle}</div>
      <div className="cf-question__options">
        {targets.map((target) => {
          const pk = target.user_pk;
          const label = target.display_name === "" ? target.username : target.display_name;
          return (
            <label key={`follow-${pk}`} className="cf-option cf-option--inline">
              <input
                type="checkbox"
                data-sunji-id={pk}
                checked={ctrl.pickedSunji.has(pk)}
                onChange={() => ctrl.toggleSunji(pk)}
              />
              <span className="cf-option__body">
                <span className="cf-option__title">{label}</span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function KeywordBlock() {
  const tr = useSpaceAnalyzesAppI18n();
  const ctrl = useAnalyzeCreateContext();
  return (
    <div className="cf-question cf-keyword-block">
      <div className="cf-question__title">{tr.createKeywordBlockTitle}</div>
      <input
        type="text"
        className="cf-keyword-input"
        id="cf-keyword-input"
        data-testid="cf-keyword-input"
        placeholder={tr.createKeywordInputPlaceholder}
        autoComplete="off"
        value={ctrl.keywordInput}
        onChange={(e) => ctrl.setKeywordInput(e.target.value)}
      />
      <div className="cf-keyword-hint">{tr.createKeywordHint}</div>
    </div>
  );
}
