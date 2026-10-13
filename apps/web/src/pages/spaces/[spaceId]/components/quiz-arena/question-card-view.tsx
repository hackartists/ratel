// app/ratel/src/features/spaces/pages/index/action_pages/quiz/component.rs:483-606 —
// `QuestionCardView`: one single/multiple-choice question as option tiles.
// Other question types render nothing (Rust `_ => return rsx! {}`).
import type { Answer, Question, QuizCorrectAnswer } from "@ratel/ts-bridges";
import { useQuizArenaI18n } from "./i18n";
import { dataBool } from "@/lib/dom";
import { LETTERS, checkCorrect, checkSelected, toggleMulti, toggleSingle } from "./quiz-helpers";
import { RichQuestionTitle } from "@/components/space-actions/rich-question-title";

export function QuestionCardView({
  index,
  total,
  question,
  answer,
  correctAnswer = null,
  disabled,
  onChange,
}: {
  index: number;
  total: number;
  question: Question;
  answer: Answer | null;
  correctAnswer?: QuizCorrectAnswer | null;
  disabled: boolean;
  onChange: (next: Answer) => void;
}) {
  const tr = useQuizArenaI18n();

  if (question.answer_type !== "single_choice" && question.answer_type !== "multiple_choice") {
    return null;
  }
  const { title, html_title: htmlTitle, description, options, is_required: isRequired } = question;
  const isMulti = question.answer_type === "multiple_choice";

  const useSingleCol = options.length > 4;
  const hasCustomDesc = description !== null && description !== "";
  const hint = isMulti ? tr.multipleChoiceHint : tr.singleChoiceHint;

  return (
    <div className="question-card">
      <div className="question-header">
        <span className="question-number">{`${tr.questionOf} ${index + 1} ${tr.ofLabel} ${total}`}</span>
        {(isRequired ?? false) && <span className="question-required">{tr.requiredLabel}</span>}
      </div>

      {htmlTitle ? (
        <RichQuestionTitle html={htmlTitle} />
      ) : (
        <div className="question-title">{title}</div>
      )}
      {hasCustomDesc ? <div className="question-desc">{description}</div> : <div className="question-desc">{hint}</div>}

      <div className={useSingleCol ? "option-grid option-grid--single" : "option-grid"}>
        {options.map((optionText, optIdx) => {
          const isSelected = checkSelected(answer, optIdx, isMulti);
          const isCorrect = checkCorrect(correctAnswer, optIdx, isMulti);
          return (
            <button
              key={`opt-${index}-${optIdx}`}
              className="option-tile"
              aria-selected={dataBool(isSelected)}
              data-correct={dataBool(isCorrect)}
              data-user-wrong={dataBool(isSelected && !isCorrect && correctAnswer !== null)}
              disabled={disabled}
              onClick={() => {
                const next = isMulti ? toggleMulti(answer, optIdx) : toggleSingle(answer, optIdx);
                onChange(next);
              }}
            >
              <div className="option-tile__accent" />
              <div className="option-tile__content">
                {isMulti ? (
                  <div className="option-tile__checkbox">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                ) : (
                  <span className="option-tile__letter">{LETTERS[optIdx] ?? ""}</span>
                )}
                <span className="option-tile__text">{optionText}</span>
              </div>
              <div className="option-tile__check">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
