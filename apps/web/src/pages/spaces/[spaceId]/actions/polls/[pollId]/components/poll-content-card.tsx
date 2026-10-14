import { useEffect, useRef, useState } from "react";
import type { ConditionOperator, Question, QuestionCondition, RequiredAttributeRule } from "@ratel/ts-bridges";
import { useUpdatePoll } from "@ratel/ts-bridges/hooks";
import { AutosaveStatusBadge, type SaveStatus } from "@/components/space-actions/autosave-status-badge";
import { Editor } from "@/components/editor/editor";
import { RequiredAttributeRulesEditor, type ChoiceCandidate } from "@/components/space-actions/required-attribute-rules-editor";
import { choiceOptions, removeQuestionAt, sanitizeQuestionFlow, terminateOn } from "./poll-flow";
import { usePollCreatorI18n } from "./poll-creator.i18n";
import { useToast } from "@/lib/toast";
import { htmlToPlainText } from "@/lib/content-body";
import { usePoll } from "../hooks/use-poll";

// poll/views/main/creator/content_card/component.rs (`ContentCard`) — title +
// question builder. The creator UI only produces five question shapes
// (single/multi/subjective/linear/privacy_consent); checkbox/dropdown/short_answer
// only ever come from legacy data and this editor doesn't offer converting
// into them.

type QType = "single" | "multi" | "subjective" | "linear" | "privacy_consent";

function qtypeStr(q: Question): QType {
  switch (q.answer_type) {
    case "single_choice":
      return "single";
    case "multiple_choice":
      return "multi";
    case "short_answer":
    case "subjective":
      return "subjective";
    case "linear_scale":
      return "linear";
    case "checkbox":
      return "multi";
    case "dropdown":
      return "single";
    case "privacy_consent":
      return "privacy_consent";
  }
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

function withHtmlTitle(q: Question, html_title: string): Question {
  return { ...q, html_title, title: htmlToPlainText(html_title) } as Question;
}

function convertToQtype(existing: Question, target: QType): Question {
  const title = existing.title;
  const html_title = existing.html_title ?? null;
  const options = optionsOf(existing);
  const opts = options.length === 0 ? ["", ""] : options;
  const display_condition = existing.display_condition ?? null;
  const terminate_on = terminateOn(existing);
  const termination_message =
    existing.answer_type === "single_choice" || existing.answer_type === "multiple_choice" || existing.answer_type === "privacy_consent"
      ? (existing.termination_message ?? null)
      : null;
  switch (target) {
    case "single":
      return {
        answer_type: "single_choice",
        title,
        html_title,
        description: null,
        image_url: null,
        options: opts,
        is_required: null,
        allow_other: null,
        terminate_on,
        display_condition,
        termination_message,
      };
    case "multi":
      return {
        answer_type: "multiple_choice",
        title,
        html_title,
        description: null,
        image_url: null,
        options: opts,
        is_required: null,
        allow_other: null,
        terminate_on,
        display_condition,
        termination_message,
      };
    case "subjective":
      return { answer_type: "subjective", title, html_title, description: "", is_required: null, display_condition };
    case "linear":
      return {
        answer_type: "linear_scale",
        title,
        html_title,
        description: null,
        image_url: null,
        min_value: 1,
        max_value: 5,
        min_label: "",
        max_label: "",
        is_required: null,
        display_condition,
      };
    case "privacy_consent":
      return {
        answer_type: "privacy_consent",
        title,
        html_title,
        description: null,
        terms_title: "",
        terms_body_html: "",
        is_required: null,
        display_condition,
        termination_message,
      };
  }
}

/** Earlier single/multiple-choice questions a question's display condition may reference. */
function conditionCandidates(questions: Question[], idx: number, pollId: string): ChoiceCandidate[] {
  return questions.slice(0, idx).flatMap((q, qi) => {
    const options = choiceOptions(q);
    if (options === null) return [];
    return [{ pollActionId: pollId, pollTitle: `Q${qi + 1}`, questionIndex: qi, questionTitle: q.title, options: options.filter((o) => o !== "") }];
  });
}

function conditionToRules(condition: QuestionCondition | null, pollId: string): RequiredAttributeRule[] {
  return (condition?.rules ?? []).map((r) => ({ poll_action_id: pollId, question_index: r.question_index, allowed_values: r.allowed_values }));
}

function withCondition(q: Question, rules: RequiredAttributeRule[], operator: ConditionOperator): Question {
  const display_condition: QuestionCondition | null =
    rules.length === 0
      ? null
      : { operator, rules: rules.map((r) => ({ question_index: r.question_index, allowed_values: r.allowed_values })) };
  return { ...q, display_condition } as Question;
}

export function PollContentCard() {
  const tr = usePollCreatorI18n();
  const toast = useToast();
  const { spaceId, pollId, poll, refresh } = usePoll();
  const update = useUpdatePoll();

  const [title, setTitle] = useState(poll.title);
  const lastSavedTitle = useRef(poll.title);
  const [titleStatus, setTitleStatus] = useState<SaveStatus>("Idle");
  const [questions, setQuestions] = useState<Question[]>(poll.questions);
  // Blur handlers are created inside the per-question JSX below and can fire
  // before React commits a same-tick setQuestions update (e.g. fill() then
  // immediately press("Tab") in tests, or a fast real keyboard blur) — a
  // handler closing over the `questions` render variable would then save a
  // stale snapshot and clobber whatever the just-applied onChange wrote.
  // Route every blur-triggered save through this ref instead so it always
  // reads the latest committed state.
  const questionsRef = useRef(questions);
  questionsRef.current = questions;

  const saveTitle = (current: string) => {
    if (current === lastSavedTitle.current) return;
    setTitleStatus("Saving");
    update
      .mutateAsync({ spacePk: spaceId, pollSk: pollId, req: { title: current } })
      .then(() => {
        lastSavedTitle.current = current;
        setTitleStatus("Saved");
        refresh();
      })
      .catch((err) => {
        setTitleStatus("Unsaved");
        toast.error(err);
      });
  };

  // Autosave title — 3-second debounce after the last edit. Reads the fresh
  // value passed in by the caller (the input's `onChange` event), never a
  // `title` state closure — a closure captured before `setTitle` takes
  // effect would schedule a save of the *previous* value and silently
  // clobber whatever was typed since.
  const titleTimer = useRef<number | null>(null);
  const scheduleTitleSave = (next: string) => {
    if (titleTimer.current !== null) window.clearTimeout(titleTimer.current);
    titleTimer.current = window.setTimeout(() => saveTitle(next), 3000);
  };
  useEffect(() => () => {
    if (titleTimer.current !== null) window.clearTimeout(titleTimer.current);
  }, []);

  const saveQuestions = (next: Question[]) => {
    update
      .mutateAsync({ spacePk: spaceId, pollSk: pollId, req: { questions: sanitizeQuestionFlow(next) } })
      .catch((err) => toast.error(err));
  };

  return (
    <section className="pager__page" data-page="0">
      <article className="page-card" data-testid="page-card-content">
        <header className="page-card__head">
          <div className="page-card__title-wrap">
            <span className="page-card__num">{tr.cardIndex1}</span>
            <div>
              <h1 className="page-card__title">{tr.cardContentTitle}</h1>
              <div className="page-card__subtitle">{tr.cardContentSubtitle}</div>
            </div>
          </div>
        </header>

        <section className="section" data-testid="section-content">
          <div className="section__head">
            <span className="section__label">{tr.sectionContentLabel}</span>
          </div>
          <div className="field">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
              <label className="field__label">{tr.titleLabel}</label>
              <AutosaveStatusBadge
                status={titleStatus}
                labels={{ autosaveSaving: tr.autosaveSaving, autosaveSaved: tr.autosaveSaved, autosaveUnsaved: tr.autosaveUnsaved }}
              />
            </div>
            <input
              className="input"
              data-testid="poll-title"
              placeholder={tr.titlePlaceholder}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setTitleStatus("Unsaved");
                scheduleTitleSave(e.target.value);
              }}
              onBlur={() => saveTitle(title)}
            />
          </div>
        </section>

        <section className="section" data-testid="section-questions">
          <div className="section__head">
            <span className="section__label">{tr.sectionQuestionsLabel}</span>
            <span className="section__hint">{tr.sectionQuestionsHint}</span>
          </div>

          {questions.map((question, idx) => (
            <QuestionBlock
              key={`q-${idx}-${questions.length}`}
              idx={idx}
              question={question}
              tr={tr}
              conditionCandidates={conditionCandidates(questions, idx, pollId)}
              pollId={pollId}
              onConditionChange={(i, rules, operator) => {
                setQuestions((qs) => {
                  const next = qs.map((q, qi) => (qi === i ? withCondition(q, rules, operator) : q));
                  saveQuestions(next);
                  return next;
                });
              }}
              onTerminateToggle={(i, value) => {
                setQuestions((qs) => {
                  const next = qs.map((q, qi) => {
                    if (qi !== i) return q;
                    if (q.answer_type === "single_choice" || q.answer_type === "multiple_choice") {
                      const current = q.terminate_on ?? [];
                      const terminate_on = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
                      return { ...q, terminate_on };
                    }
                    return q;
                  });
                  saveQuestions(next);
                  return next;
                });
              }}
              onTitleChange={(i, html) => {
                setQuestions((qs) => {
                  const next = qs.map((q, qi) => (qi === i ? withHtmlTitle(q, html) : q));
                  saveQuestions(next);
                  return next;
                });
              }}
              onTypeChange={(i, target) => {
                setQuestions((qs) => {
                  const next = sanitizeQuestionFlow(qs.map((q, qi) => (qi === i ? convertToQtype(q, target) : q)));
                  saveQuestions(next);
                  return next;
                });
              }}
              onOptionChange={(i, optIdx, value) => {
                setQuestions((qs) =>
                  sanitizeQuestionFlow(
                    qs.map((q, qi) => {
                      if (qi !== i) return q;
                      if (q.answer_type === "single_choice" || q.answer_type === "multiple_choice") {
                        const options = q.options.slice();
                        options[optIdx] = value;
                        return { ...q, options };
                      }
                      return q;
                    }),
                  ),
                );
              }}
              onOptionAdd={(i) => {
                setQuestions((qs) => {
                  const next = qs.map((q, qi) => {
                    if (qi !== i) return q;
                    if (q.answer_type === "single_choice" || q.answer_type === "multiple_choice") {
                      return { ...q, options: [...q.options, ""] };
                    }
                    return q;
                  });
                  saveQuestions(next);
                  return next;
                });
              }}
              onOptionRemove={(i, optIdx) => {
                setQuestions((qs) => {
                  const next = sanitizeQuestionFlow(
                    qs.map((q, qi) => {
                      if (qi !== i) return q;
                      if (q.answer_type === "single_choice" || q.answer_type === "multiple_choice") {
                        if (q.options.length > 1 && optIdx < q.options.length) {
                          return { ...q, options: q.options.filter((_, oi) => oi !== optIdx) };
                        }
                      }
                      return q;
                    }),
                  );
                  saveQuestions(next);
                  return next;
                });
              }}
              onAllowOtherToggle={(i) => {
                setQuestions((qs) => {
                  const next = qs.map((q, qi) => {
                    if (qi !== i) return q;
                    if (q.answer_type === "single_choice" || q.answer_type === "multiple_choice") {
                      return { ...q, allow_other: !(q.allow_other ?? false) };
                    }
                    return q;
                  });
                  saveQuestions(next);
                  return next;
                });
              }}
              onRemove={(i) => {
                setQuestions((qs) => {
                  const next = removeQuestionAt(qs, i);
                  saveQuestions(next);
                  return next;
                });
              }}
              onSubjectiveChange={(i, value) => {
                setQuestions((qs) =>
                  qs.map((q, qi) => {
                    if (qi !== i) return q;
                    if (q.answer_type === "subjective" || q.answer_type === "short_answer") {
                      return { ...q, description: value };
                    }
                    return q;
                  }),
                );
              }}
              onLinearChange={(i, min, max) => {
                setQuestions((qs) =>
                  qs.map((q, qi) => {
                    if (qi !== i) return q;
                    if (q.answer_type === "linear_scale") return { ...q, min_value: min, max_value: max };
                    return q;
                  }),
                );
              }}
              onPrivacyConsentChange={(i, patch) => {
                setQuestions((qs) => {
                  const next = qs.map((q, qi) => {
                    if (qi !== i) return q;
                    if (q.answer_type === "privacy_consent") return { ...q, ...patch };
                    return q;
                  });
                  saveQuestions(next);
                  return next;
                });
              }}
              onTerminationMessageChange={(i, value) => {
                setQuestions((qs) =>
                  qs.map((q, qi) => {
                    if (qi !== i) return q;
                    if (q.answer_type === "single_choice" || q.answer_type === "multiple_choice" || q.answer_type === "privacy_consent") {
                      return { ...q, termination_message: value.trim() === "" ? null : value };
                    }
                    return q;
                  }),
                );
              }}
              onBlurSave={() => saveQuestions(questionsRef.current)}
            />
          ))}

          <button
            className="add-btn"
            type="button"
            data-testid="poll-question-add"
            onClick={() => {
              setQuestions((qs) => {
                const next = [
                  ...qs,
                  {
                    answer_type: "single_choice",
                    title: "",
                    html_title: null,
                    description: null,
                    image_url: null,
                    options: ["", ""],
                    is_required: null,
                    allow_other: null,
                    terminate_on: [],
                    display_condition: null,
                    termination_message: null,
                  } as Question,
                ];
                saveQuestions(next);
                return next;
              });
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
  tr: ReturnType<typeof usePollCreatorI18n>;
  pollId: string;
  conditionCandidates: ChoiceCandidate[];
  onConditionChange: (idx: number, rules: RequiredAttributeRule[], operator: ConditionOperator) => void;
  onTerminateToggle: (idx: number, value: string) => void;
  onTitleChange: (idx: number, value: string) => void;
  onTypeChange: (idx: number, target: QType) => void;
  onOptionChange: (idx: number, optIdx: number, value: string) => void;
  onOptionAdd: (idx: number) => void;
  onOptionRemove: (idx: number, optIdx: number) => void;
  onAllowOtherToggle: (idx: number) => void;
  onRemove: (idx: number) => void;
  onSubjectiveChange: (idx: number, value: string) => void;
  onLinearChange: (idx: number, min: number, max: number) => void;
  onPrivacyConsentChange: (idx: number, patch: { terms_title?: string; terms_body_html?: string }) => void;
  onTerminationMessageChange: (idx: number, value: string) => void;
  onBlurSave: () => void;
}

function QuestionBlock({
  idx,
  question,
  tr,
  pollId,
  conditionCandidates,
  onConditionChange,
  onTerminateToggle,
  onTitleChange,
  onTypeChange,
  onOptionChange,
  onOptionAdd,
  onOptionRemove,
  onAllowOtherToggle,
  onRemove,
  onSubjectiveChange,
  onLinearChange,
  onPrivacyConsentChange,
  onTerminationMessageChange,
  onBlurSave,
}: QuestionBlockProps) {
  const qtype = qtypeStr(question);
  const qNum = idx + 1;
  const isSingle = qtype === "single";
  const isMulti = qtype === "multi";
  const isSubjective = qtype === "subjective";
  const isLinear = qtype === "linear";
  const isPrivacyConsent = qtype === "privacy_consent";
  const condition = question.display_condition ?? null;
  const operator: ConditionOperator = condition?.operator ?? "And";
  const conditionRules = conditionToRules(condition, pollId);
  const choiceOpts = choiceOptions(question);
  const stops = terminateOn(question);
  const canTerminate = isPrivacyConsent || stops.length > 0;
  const customTerminationMessage =
    question.answer_type === "single_choice" || question.answer_type === "multiple_choice" || question.answer_type === "privacy_consent"
      ? (question.termination_message ?? "")
      : "";

  return (
    <div className="q-block" data-qtype={qtype} data-testid={`poll-question-${idx}`}>
      <div className="q-block__head">
        <span className="q-block__num">{`Q${qNum}`}</span>
        <div className="segmented segmented--sm" role="tablist" data-testid={`poll-question-${idx}-type`}>
          <button
            className="segmented__btn"
            type="button"
            role="tab"
            aria-selected={isSingle ? "true" : "false"}
            onClick={() => onTypeChange(idx, "single")}
          >
            {tr.qtypeSingle}
          </button>
          <button
            className="segmented__btn"
            type="button"
            role="tab"
            aria-selected={isMulti ? "true" : "false"}
            onClick={() => onTypeChange(idx, "multi")}
          >
            {tr.qtypeMulti}
          </button>
          <button
            className="segmented__btn"
            type="button"
            role="tab"
            aria-selected={isSubjective ? "true" : "false"}
            onClick={() => onTypeChange(idx, "subjective")}
          >
            {tr.qtypeSubjective}
          </button>
          <button
            className="segmented__btn"
            type="button"
            role="tab"
            aria-selected={isLinear ? "true" : "false"}
            onClick={() => onTypeChange(idx, "linear")}
          >
            {tr.qtypeLinear}
          </button>
          <button
            className="segmented__btn"
            type="button"
            role="tab"
            aria-selected={isPrivacyConsent ? "true" : "false"}
            data-qtype-set="privacy_consent"
            onClick={() => onTypeChange(idx, "privacy_consent")}
          >
            {tr.qtypePrivacyConsent}
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

      <div data-testid={`poll-question-${idx}-title`}>
        <Editor
          className="[&_.re-toolbar]:border-b [&_.re-toolbar]:border-[rgba(255,255,255,0.06)] [&_.re-content]:min-h-[48px] [&_.re-content]:px-[14px] [&_.re-content]:py-[10px] [&_.re-content]:outline-none"
          content={question.html_title ?? question.title}
          placeholder={tr.questionTitlePlaceholder}
          onContentChange={(html) => onTitleChange(idx, html)}
        />
      </div>

      {(isSingle || isMulti) && (
        <ChoiceOptions
          idx={idx}
          question={question}
          isCheck={isMulti}
          tr={tr}
          onOptionChange={onOptionChange}
          onOptionAdd={onOptionAdd}
          onOptionRemove={onOptionRemove}
          onAllowOtherToggle={onAllowOtherToggle}
          onBlurSave={onBlurSave}
        />
      )}
      {isSubjective && <SubjectiveBody idx={idx} question={question} tr={tr} onSubjectiveChange={onSubjectiveChange} onBlurSave={onBlurSave} />}
      {isLinear && <LinearBody idx={idx} question={question} tr={tr} onLinearChange={onLinearChange} onBlurSave={onBlurSave} />}
      {isPrivacyConsent && (
        <PrivacyConsentBody
          idx={idx}
          question={question}
          tr={tr}
          onPrivacyConsentChange={onPrivacyConsentChange}
          onBlurSave={onBlurSave}
        />
      )}

      {choiceOpts !== null && choiceOpts.some((o) => o !== "") && (
        <div className="flex flex-col gap-2 w-full" data-testid={`poll-question-${idx}-terminate`}>
          <span className="font-medium text-[12px]/[16px] text-foreground-muted">{tr.terminateHint}</span>
          <div className="flex flex-wrap gap-2">
            {choiceOpts.map((opt, oi) =>
              opt === "" ? null : (
                <button
                  key={`term-${oi}`}
                  type="button"
                  aria-pressed={stops.includes(opt)}
                  data-testid={`poll-question-${idx}-terminate-${oi}`}
                  className={`py-1 px-2.5 rounded-full text-[12px]/[16px] border ${
                    stops.includes(opt) ? "bg-primary/10 border-primary text-primary" : "border-separator text-foreground-muted"
                  }`}
                  onClick={() => onTerminateToggle(idx, opt)}
                >
                  {opt}
                </button>
              ),
            )}
          </div>
        </div>
      )}

      {canTerminate && (
        <TerminationMessageField
          idx={idx}
          value={customTerminationMessage}
          tr={tr}
          onChange={onTerminationMessageChange}
          onBlurSave={onBlurSave}
        />
      )}

      {idx > 0 && (
        <div className="w-full" data-testid={`poll-question-${idx}-condition`}>
          <RequiredAttributeRulesEditor
            candidates={conditionCandidates}
            value={conditionRules}
            onChange={(rules) => onConditionChange(idx, rules, operator)}
            operator={operator}
            onOperatorChange={(op) => onConditionChange(idx, conditionRules, op)}
            hint={tr.conditionHint}
            emptyText={tr.conditionEmpty}
            addLabel={tr.conditionAdd}
          />
        </div>
      )}
    </div>
  );
}

function ChoiceOptions({
  idx,
  question,
  isCheck,
  tr,
  onOptionChange,
  onOptionAdd,
  onOptionRemove,
  onAllowOtherToggle,
  onBlurSave,
}: {
  idx: number;
  question: Question;
  isCheck: boolean;
  tr: ReturnType<typeof usePollCreatorI18n>;
  onOptionChange: (idx: number, optIdx: number, value: string) => void;
  onOptionAdd: (idx: number) => void;
  onOptionRemove: (idx: number, optIdx: number) => void;
  onAllowOtherToggle: (idx: number) => void;
  onBlurSave: () => void;
}) {
  const options = optionsOf(question);
  const hasMultipleOptions = options.length > 1;
  const allowOther =
    question.answer_type === "single_choice" || question.answer_type === "multiple_choice" ? (question.allow_other ?? false) : false;

  const bodyClass = isCheck ? "q-body q-body--multi" : "q-body q-body--single";
  const optClass = isCheck ? "q-opt q-opt--check" : "q-opt";

  return (
    <div className={bodyClass}>
      {options.map((opt, i) => (
        <div key={`opt-${i}`} className={optClass} aria-checked="false" data-testid={`poll-question-${idx}-opt-${i}`}>
          <span className="q-opt__radio" />
          <input className="input" value={opt} onChange={(e) => onOptionChange(idx, i, e.target.value)} onBlur={onBlurSave} />
          {hasMultipleOptions && (
            <button
              className="q-opt__remove"
              type="button"
              aria-label={tr.removeOption}
              data-testid={`poll-question-${idx}-opt-${i}-remove`}
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
      ))}
      <button className="add-btn add-btn--sm" type="button" data-testid={`poll-question-${idx}-opt-add`} onClick={() => onOptionAdd(idx)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        {tr.addOption}
      </button>
      <label className="q-opt__other-toggle" data-testid={`poll-question-${idx}-allow-other`}>
        <input type="checkbox" checked={allowOther} onChange={() => onAllowOtherToggle(idx)} />
        <span>{tr.allowOther}</span>
      </label>
    </div>
  );
}

function SubjectiveBody({
  idx,
  question,
  tr,
  onSubjectiveChange,
  onBlurSave,
}: {
  idx: number;
  question: Question;
  tr: ReturnType<typeof usePollCreatorI18n>;
  onSubjectiveChange: (idx: number, value: string) => void;
  onBlurSave: () => void;
}) {
  const value = question.answer_type === "subjective" || question.answer_type === "short_answer" ? question.description : "";
  return (
    <div className="q-body q-body--subjective">
      <span className="q-subjective-hint">{tr.subjectiveHint}</span>
      <textarea
        className="textarea"
        data-testid={`poll-question-${idx}-hint`}
        placeholder={tr.subjectivePlaceholder}
        value={value}
        onChange={(e) => onSubjectiveChange(idx, e.target.value)}
        onBlur={onBlurSave}
      />
    </div>
  );
}

function LinearBody({
  idx,
  question,
  tr,
  onLinearChange,
  onBlurSave,
}: {
  idx: number;
  question: Question;
  tr: ReturnType<typeof usePollCreatorI18n>;
  onLinearChange: (idx: number, min: number, max: number) => void;
  onBlurSave: () => void;
}) {
  const [minV, maxV] = question.answer_type === "linear_scale" ? [question.min_value, question.max_value] : [1, 5];
  return (
    <div className="q-body q-body--linear">
      <div className="q-linear-row">
        <div className="field">
          <label className="field__label">{tr.linearMinLabel}</label>
          <input
            className="input input--num"
            type="number"
            data-testid={`poll-question-${idx}-min`}
            value={minV}
            onChange={(e) => {
              const v = Number.parseInt(e.target.value, 10);
              if (!Number.isNaN(v)) onLinearChange(idx, v, maxV);
            }}
            onBlur={onBlurSave}
          />
        </div>
        <div className="q-linear-preview">
          <span>{minV}</span>
          <span className="q-linear-preview__dot" />
          <span className="q-linear-preview__dot" />
          <span className="q-linear-preview__dot q-linear-preview__dot--filled" />
          <span className="q-linear-preview__dot" />
          <span className="q-linear-preview__dot" />
          <span>{maxV}</span>
        </div>
        <div className="field">
          <label className="field__label">{tr.linearMaxLabel}</label>
          <input
            className="input input--num"
            type="number"
            data-testid={`poll-question-${idx}-max`}
            value={maxV}
            onChange={(e) => {
              const v = Number.parseInt(e.target.value, 10);
              if (!Number.isNaN(v)) onLinearChange(idx, minV, v);
            }}
            onBlur={onBlurSave}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Optional author copy shown in the termination confirmation instead of the
 * default message. Kept as a local draft so typing spaces or line breaks is
 * not swallowed by the blank-to-null normalization of the saved value.
 */
function TerminationMessageField({
  idx,
  value,
  tr,
  onChange,
  onBlurSave,
}: {
  idx: number;
  value: string;
  tr: ReturnType<typeof usePollCreatorI18n>;
  onChange: (idx: number, value: string) => void;
  onBlurSave: () => void;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <div className="field w-full" data-testid={`poll-question-${idx}-termination`}>
      <label className="field__label">{tr.terminationMessageLabel}</label>
      <textarea
        className="textarea"
        data-testid={`poll-question-${idx}-termination-message`}
        placeholder={tr.terminationMessagePlaceholder}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          onChange(idx, e.target.value);
        }}
        onBlur={onBlurSave}
      />
    </div>
  );
}

function PrivacyConsentBody({
  idx,
  question,
  tr,
  onPrivacyConsentChange,
  onBlurSave,
}: {
  idx: number;
  question: Question;
  tr: ReturnType<typeof usePollCreatorI18n>;
  onPrivacyConsentChange: (idx: number, patch: { terms_title?: string; terms_body_html?: string }) => void;
  onBlurSave: () => void;
}) {
  const termsTitle = question.answer_type === "privacy_consent" ? question.terms_title : "";
  const termsBodyHtml = question.answer_type === "privacy_consent" ? question.terms_body_html : "";

  return (
    <div className="q-body q-body--privacy-consent" data-testid={`poll-question-${idx}-privacy-consent`}>
      <span className="always-on-pill" data-testid={`poll-question-${idx}-phone-always-on`}>
        {tr.privacyConsentAlwaysOn}
      </span>
      <div className="field">
        <label className="field__label">{tr.privacyConsentTermsTitleLabel}</label>
        <input
          className="input"
          data-testid={`poll-question-${idx}-terms-title`}
          placeholder={tr.privacyConsentTermsTitlePlaceholder}
          value={termsTitle}
          onChange={(e) => onPrivacyConsentChange(idx, { terms_title: e.target.value })}
          onBlur={onBlurSave}
        />
      </div>
      <div className="field">
        <label className="field__label">{tr.privacyConsentTermsBodyLabel}</label>
        <Editor
          className="poll-privacy-consent-editor"
          content={termsBodyHtml}
          onContentChange={(html) => {
            onPrivacyConsentChange(idx, { terms_body_html: html });
          }}
        />
      </div>
    </div>
  );
}
