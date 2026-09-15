import type { Question, QuizCorrectAnswer, UpdateQuizRequest } from "@ratel/ts-bridges";
import { useUpdateQuiz } from "@ratel/ts-bridges/hooks";
import { useQuizCreatorI18n } from "./quiz-creator.i18n";
import { useToast } from "@/lib/toast";
import { useQuiz } from "../hooks/use-quiz";

// quiz/views/main/creator/questions_card/component.rs (`QuestionsCard`) —
// unlike the poll editor, quiz questions carry a correct-answer alongside
// each option; only single/multiple choice are offered.

type QType = "single" | "multi";

function qtypeStr(q: Question): QType {
  return q.answer_type === "multiple_choice" || q.answer_type === "checkbox" ? "multi" : "single";
}

function optionsOf(q: Question): string[] {
  switch (q.answer_type) {
    case "single_choice":
    case "multiple_choice":
    case "checkbox":
    case "dropdown":
      return q.options;
    default:
      return [];
  }
}

function withTitle(q: Question, title: string): Question {
  return { ...q, title } as Question;
}

function convertToQtype(existing: Question, target: QType): Question {
  const title = existing.title;
  const options = optionsOf(existing);
  const opts = options.length === 0 ? ["", ""] : options;
  return target === "multi"
    ? { answer_type: "multiple_choice", title, description: null, image_url: null, options: opts, is_required: null, allow_other: null }
    : { answer_type: "single_choice", title, description: null, image_url: null, options: opts, is_required: null, allow_other: null };
}

function correctAnswerForQuestion(q: Question): QuizCorrectAnswer {
  return q.answer_type === "multiple_choice" ? { answer_type: "multiple", answers: [] } : { answer_type: "single", answer: null };
}

function emptyUpdate(): UpdateQuizRequest {
  return { title: null, description: null, retry_count: null, pass_score: null, questions: null, answers: null, files: null };
}

export function QuizQuestionsCard() {
  const tr = useQuizCreatorI18n();
  const toast = useToast();
  const { spaceId, quizId, questions, setQuestions, answers, setAnswers, passScore, retryCount } = useQuiz();
  const update = useUpdateQuiz();

  const save = (nextQuestions: Question[], nextAnswers: QuizCorrectAnswer[]) => {
    update
      .mutateAsync({
        spacePk: spaceId,
        quizId,
        req: { ...emptyUpdate(), questions: nextQuestions, answers: nextAnswers, pass_score: passScore, retry_count: retryCount },
      })
      .catch((err) => toast.error(err));
  };

  return (
    <section className="pager__page" data-page="1">
      <article className="page-card" data-testid="page-card-questions">
        <header className="page-card__head">
          <div className="page-card__title-wrap">
            <span className="page-card__num">{tr.cardIndex2}</span>
            <div>
              <h1 className="page-card__title">{tr.cardQuestionsTitle}</h1>
              <div className="page-card__subtitle">{tr.cardQuestionsSubtitle}</div>
            </div>
          </div>
        </header>

        <section className="section" data-testid="section-questions">
          <div className="section__head">
            <span className="section__label">{tr.sectionQuestionsLabel}</span>
            <span className="section__hint">{tr.sectionQuestionsHint}</span>
          </div>

          {questions.map((question, idx) => (
            <QuestionBlock
              key={`q-${idx}`}
              idx={idx}
              question={question}
              answer={answers[idx] ?? { answer_type: "single", answer: null }}
              tr={tr}
              onTitleChange={(i, value) => setQuestions((qs) => qs.map((q, qi) => (qi === i ? withTitle(q, value) : q)))}
              onTypeChange={(i, target) => {
                const newQ = convertToQtype(questions[i], target);
                const newA = correctAnswerForQuestion(newQ);
                const nextQuestions = questions.map((q, qi) => (qi === i ? newQ : q));
                const nextAnswers = answers.map((a, qi) => (qi === i ? newA : a));
                setQuestions(nextQuestions);
                setAnswers(nextAnswers);
                save(nextQuestions, nextAnswers);
              }}
              onOptionChange={(i, optIdx, value) => {
                setQuestions((qs) =>
                  qs.map((q, qi) => {
                    if (qi !== i) return q;
                    if (q.answer_type === "single_choice" || q.answer_type === "multiple_choice") {
                      const options = q.options.slice();
                      options[optIdx] = value;
                      return { ...q, options };
                    }
                    return q;
                  }),
                );
              }}
              onOptionAdd={(i) => {
                const nextQuestions = questions.map((q, qi) => {
                  if (qi !== i) return q;
                  if (q.answer_type === "single_choice" || q.answer_type === "multiple_choice") return { ...q, options: [...q.options, ""] };
                  return q;
                });
                setQuestions(nextQuestions);
                save(nextQuestions, answers);
              }}
              onOptionRemove={(i, optIdx) => {
                const nextQuestions = questions.map((q, qi) => {
                  if (qi !== i) return q;
                  if (q.answer_type === "single_choice" || q.answer_type === "multiple_choice") {
                    if (q.options.length > 1 && optIdx < q.options.length) return { ...q, options: q.options.filter((_, oi) => oi !== optIdx) };
                  }
                  return q;
                });
                // Fix up the correct-answer index if it pointed at the removed option.
                const nextAnswers = answers.map((a, qi) => {
                  if (qi !== i) return a;
                  if (a.answer_type === "single") {
                    if (a.answer === optIdx) return { answer_type: "single", answer: null } as QuizCorrectAnswer;
                    if (a.answer !== null && a.answer > optIdx) return { answer_type: "single", answer: a.answer - 1 } as QuizCorrectAnswer;
                    return a;
                  }
                  const arr = a.answers.filter((x) => x !== optIdx).map((x) => (x > optIdx ? x - 1 : x));
                  return { answer_type: "multiple", answers: arr } as QuizCorrectAnswer;
                });
                setQuestions(nextQuestions);
                setAnswers(nextAnswers);
                save(nextQuestions, nextAnswers);
              }}
              onCorrectToggle={(i, optIdx) => {
                const qtype = qtypeStr(questions[i]);
                const current = answers[i];
                let next: QuizCorrectAnswer;
                if (qtype === "multi") {
                  const arr = current.answer_type === "multiple" ? current.answers : [];
                  next = arr.includes(optIdx)
                    ? { answer_type: "multiple", answers: arr.filter((x) => x !== optIdx) }
                    : { answer_type: "multiple", answers: [...arr, optIdx].sort((a, b) => a - b) };
                } else {
                  next = { answer_type: "single", answer: optIdx };
                }
                const nextAnswers = answers.map((a, qi) => (qi === i ? next : a));
                setAnswers(nextAnswers);
                save(questions, nextAnswers);
              }}
              onRemove={(i) => {
                const nextQuestions = questions.filter((_, qi) => qi !== i);
                const nextAnswers = answers.filter((_, qi) => qi !== i);
                setQuestions(nextQuestions);
                setAnswers(nextAnswers);
                save(nextQuestions, nextAnswers);
              }}
              onBlurSave={() => save(questions, answers)}
            />
          ))}

          <button
            className="add-btn"
            type="button"
            data-testid="quiz-question-add"
            onClick={() => {
              const newQ: Question = { answer_type: "single_choice", title: "", description: null, image_url: null, options: ["", ""], is_required: null, allow_other: null };
              const newA = correctAnswerForQuestion(newQ);
              const nextQuestions = [...questions, newQ];
              const nextAnswers = [...answers, newA];
              setQuestions(nextQuestions);
              setAnswers(nextAnswers);
              save(nextQuestions, nextAnswers);
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {tr.addQuestion}
          </button>
        </section>
      </article>
    </section>
  );
}

interface QuestionBlockProps {
  idx: number;
  question: Question;
  answer: QuizCorrectAnswer;
  tr: ReturnType<typeof useQuizCreatorI18n>;
  onTitleChange: (idx: number, value: string) => void;
  onTypeChange: (idx: number, target: QType) => void;
  onOptionChange: (idx: number, optIdx: number, value: string) => void;
  onOptionAdd: (idx: number) => void;
  onOptionRemove: (idx: number, optIdx: number) => void;
  onCorrectToggle: (idx: number, optIdx: number) => void;
  onRemove: (idx: number) => void;
  onBlurSave: () => void;
}

function QuestionBlock({
  idx,
  question,
  answer,
  tr,
  onTitleChange,
  onTypeChange,
  onOptionChange,
  onOptionAdd,
  onOptionRemove,
  onCorrectToggle,
  onRemove,
  onBlurSave,
}: QuestionBlockProps) {
  const qtype = qtypeStr(question);
  const isSingle = qtype === "single";
  const isMulti = qtype === "multi";
  const options = optionsOf(question);
  const hasMultipleOptions = options.length > 1;
  const optClass = isMulti ? "q-opt q-opt--check" : "q-opt";
  const bodyClass = isMulti ? "q-body q-body--multi" : "q-body q-body--single";

  return (
    <div className="q-block" data-qtype={qtype} data-testid={`quiz-question-${idx}`}>
      <div className="q-block__head">
        <span className="q-block__num">{`Q${idx + 1}`}</span>
        <div className="segmented segmented--sm" role="tablist" data-testid={`quiz-question-${idx}-type`}>
          <button className="segmented__btn" type="button" role="tab" aria-selected={isSingle ? "true" : "false"} onClick={() => onTypeChange(idx, "single")}>
            {tr.qtypeSingle}
          </button>
          <button className="segmented__btn" type="button" role="tab" aria-selected={isMulti ? "true" : "false"} onClick={() => onTypeChange(idx, "multi")}>
            {tr.qtypeMulti}
          </button>
        </div>
        <div className="q-block__head-spacer" />
        <button className="icon-btn" type="button" aria-label={tr.removeQuestion} onClick={() => onRemove(idx)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <input className="input" value={question.title} onChange={(e) => onTitleChange(idx, e.target.value)} onBlur={onBlurSave} />

      <div className={bodyClass}>
        {options.map((opt, i) => {
          const checked = answer.answer_type === "single" ? answer.answer === i : answer.answers.includes(i);
          return (
            <div key={`opt-${i}`} className={optClass} aria-checked={checked ? "true" : "false"} data-testid={`quiz-question-${idx}-opt-${i}`}>
              <span className="q-opt__radio" onClick={() => onCorrectToggle(idx, i)} />
              <input className="input" value={opt} onChange={(e) => onOptionChange(idx, i, e.target.value)} onBlur={onBlurSave} />
              {hasMultipleOptions && (
                <button
                  className="q-opt__remove"
                  type="button"
                  aria-label={tr.removeOption}
                  data-testid={`quiz-question-${idx}-opt-${i}-remove`}
                  onClick={() => onOptionRemove(idx, i)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                    <path d="M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2" />
                  </svg>
                </button>
              )}
            </div>
          );
        })}
        <button className="add-btn add-btn--sm" type="button" data-testid={`quiz-question-${idx}-opt-add`} onClick={() => onOptionAdd(idx)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {tr.addOption}
        </button>
      </div>
    </div>
  );
}
