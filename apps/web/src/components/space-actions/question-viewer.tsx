import { useEffect, useState, type ReactNode } from "react";
import type { Answer, Question } from "@ratel/ts-bridges";
import { useGetMyPhone, useSendCode, useVerifyCode } from "@ratel/ts-bridges/hooks";
import { Check } from "@/components/icons/validations";
import { Button, ButtonShape, ButtonStyle } from "@/components/ui/button";
import { Input, InputVariant } from "@/components/ui/input";
import { PhoneInput, type PhoneInputValue } from "@/components/ui/phone-input";
import { TextArea } from "@/components/ui/textarea";
import { useQuestionViewerI18n } from "./question-viewer.i18n";

// app/ratel/src/features/spaces/pages/actions/actions/poll/components/question_viewer —
// shared by the poll and quiz response flows. Renders one question per call;
// the "other" free-text option is used by poll single/multi-choice only.

/** `should_auto_next` — single-select question types auto-advance once answered. */
export function shouldAutoNext(question: Question, answer: Answer): boolean {
  if (question.answer_type === "single_choice" && answer.answer_type === "single_choice" && answer.answer !== null) {
    return true;
  }
  if (question.answer_type === "dropdown" && answer.answer_type === "dropdown" && answer.answer !== null) {
    return true;
  }
  if (question.answer_type === "linear_scale" && answer.answer_type === "linear_scale" && answer.answer !== null) {
    return true;
  }
  return false;
}

/** `has_answer_for_question`. */
export function hasAnswerForQuestion(question: Question, answer: Answer | undefined): boolean {
  if (!answer) return false;
  switch (question.answer_type) {
    case "single_choice":
      if (answer.answer_type !== "single_choice") return false;
      if (answer.answer !== null) return true;
      return answer.other !== null && answer.other.trim() !== "";
    case "multiple_choice":
      if (answer.answer_type !== "multiple_choice") return false;
      if (answer.other !== null && answer.other.trim() !== "") return true;
      return (answer.answer ?? []).length > 0;
    case "short_answer":
      return answer.answer_type === "short_answer" && answer.answer !== null && answer.answer.trim() !== "";
    case "subjective":
      return answer.answer_type === "subjective" && answer.answer !== null && answer.answer.trim() !== "";
    case "checkbox":
      return answer.answer_type === "checkbox" && (answer.answer ?? []).length > 0;
    case "dropdown":
      return answer.answer_type === "dropdown" && answer.answer !== null;
    case "linear_scale":
      return answer.answer_type === "linear_scale" && answer.answer !== null;
    case "privacy_consent":
      return (
        answer.answer_type === "privacy_consent" && answer.agreed === true && answer.phone !== null && answer.phone.trim() !== ""
      );
  }
}

export interface QuestionViewerProps {
  index: number;
  total: number;
  question: Question;
  answer?: Answer;
  disabled: boolean;
  onChange: (answer: Answer) => void;
  enableOtherOption?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  nextDisabled?: boolean;
}

export function QuestionViewer({
  index,
  total,
  question,
  answer,
  disabled,
  onChange,
  enableOtherOption = false,
  onPrev,
  onNext,
  nextDisabled = false,
}: QuestionViewerProps) {
  const tr = useQuestionViewerI18n();

  let body: ReactNode;
  switch (question.answer_type) {
    case "single_choice":
      body = (
        <ChoiceViewer
          index={index}
          question={question}
          answer={answer}
          disabled={disabled}
          enableOtherOption={enableOtherOption}
          multi={false}
          onChange={onChange}
        />
      );
      break;
    case "multiple_choice":
      body = (
        <ChoiceViewer
          index={index}
          question={question}
          answer={answer}
          disabled={disabled}
          enableOtherOption={enableOtherOption}
          multi={true}
          onChange={onChange}
        />
      );
      break;
    case "short_answer":
      body = <SubjectiveViewer question={question} answer={answer} disabled={disabled} onChange={onChange} isShort />;
      break;
    case "subjective":
      body = (
        <SubjectiveViewer question={question} answer={answer} disabled={disabled} onChange={onChange} isShort={false} />
      );
      break;
    case "checkbox":
      body = <CheckboxViewer index={index} question={question} answer={answer} disabled={disabled} onChange={onChange} />;
      break;
    case "dropdown":
      body = <DropdownViewer question={question} answer={answer} disabled={disabled} onChange={onChange} />;
      break;
    case "linear_scale":
      body = <LinearScaleViewer question={question} answer={answer} disabled={disabled} onChange={onChange} />;
      break;
    case "privacy_consent":
      body = <PrivacyConsentViewer question={question} answer={answer} disabled={disabled} onChange={onChange} />;
      break;
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      {body}

      {(onPrev !== undefined || onNext !== undefined) && (
        <div className="flex w-full items-center justify-end gap-3 pt-2">
          {index > 0 && onPrev !== undefined && (
            <Button buttonStyle={ButtonStyle.Outline} shape={ButtonShape.Square} className="min-w-[120px]" onClick={onPrev}>
              {tr.btnBack}
            </Button>
          )}
          {index + 1 < total && (
            <Button
              buttonStyle={ButtonStyle.Outline}
              shape={ButtonShape.Square}
              className="min-w-[120px]"
              disabled={nextDisabled}
              onClick={() => onNext?.()}
            >
              {tr.btnNext}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function QuestionTitle({
  title,
  htmlTitle,
  description,
  isRequired,
}: {
  title: string;
  htmlTitle?: string | null;
  description?: string | null;
  isRequired?: boolean | null;
}) {
  return (
    <div className="mb-3 flex flex-col gap-1" data-question-title-wrap="true">
      <div className="flex items-center gap-1">
        {htmlTitle ? (
          <div
            className="re-content text-lg font-semibold text-poll-question-title"
            data-question-title="true"
            dangerouslySetInnerHTML={{ __html: htmlTitle }}
          />
        ) : (
          <span className="text-lg font-semibold text-poll-question-title" data-question-title="true">
            {title}
          </span>
        )}
        {isRequired === true && <span className="text-red-500">*</span>}
      </div>
      {description !== undefined && description !== null && description !== "" && (
        <p className="text-sm text-text-primary-muted" data-question-desc="true">
          {description}
        </p>
      )}
    </div>
  );
}

const OPTION_BASE_CLASS =
  "group relative flex min-h-[88px] w-full items-center overflow-hidden rounded-xl text-left transition-all bg-option-card-bg hover:bg-option-card-hover-bg aria-selected:bg-gradient-to-r aria-selected:from-primary/80 aria-selected:to-primary aria-selected:shadow-[0_8px_20px_rgba(0,0,0,0.2)] aria-selected:ring-2 aria-selected:ring-primary/90";
/** The "other" answer card: `OPTION_BASE_CLASS` without the selected-state ring (question_viewer.rs:341). */
const OTHER_OPTION_BASE_CLASS =
  "group relative flex min-h-[88px] w-full items-center overflow-hidden rounded-xl text-left transition-all bg-option-card-bg hover:bg-option-card-hover-bg aria-selected:bg-gradient-to-r aria-selected:from-primary/80 aria-selected:to-primary aria-selected:shadow-[0_8px_20px_rgba(0,0,0,0.2)]";

interface ChoiceQuestion {
  title: string;
  html_title?: string | null;
  description: string | null;
  options: string[];
  is_required: boolean | null;
  allow_other?: boolean | null;
}

function ChoiceViewer({
  index,
  question,
  answer,
  disabled,
  enableOtherOption,
  multi,
  onChange,
}: {
  index: number;
  question: ChoiceQuestion;
  answer?: Answer;
  disabled: boolean;
  enableOtherOption: boolean;
  multi: boolean;
  onChange: (answer: Answer) => void;
}) {
  const tr = useQuestionViewerI18n();

  const selectedSingle =
    !multi && answer?.answer_type === "single_choice" ? answer.answer : null;
  const selectedMulti =
    multi && answer?.answer_type === "multiple_choice" ? answer.answer ?? [] : [];
  const otherValue =
    (!multi && answer?.answer_type === "single_choice" ? answer.other : null) ??
    (multi && answer?.answer_type === "multiple_choice" ? answer.other : null) ??
    "";
  const otherSelected = multi
    ? answer?.answer_type === "multiple_choice" && answer.other !== null
    : answer?.answer_type === "single_choice" && answer.other !== null;

  const emit = (opts: { answer: number | number[] | null; other: string | null }) => {
    if (multi) {
      onChange({ answer_type: "multiple_choice", answer: opts.answer as number[] | null, other: opts.other });
    } else {
      onChange({ answer_type: "single_choice", answer: opts.answer as number | null, other: opts.other });
    }
  };

  return (
    <>
      <QuestionTitle title={question.title} htmlTitle={question.html_title} description={question.description} isRequired={question.is_required} />
      <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2">
        {question.options.map((option, optIdx) => {
          const isSelected = multi ? selectedMulti.includes(optIdx) : selectedSingle === optIdx;
          return (
            <button
              key={`opt-${index}-${optIdx}`}
              type="button"
              data-testid={`question-option-${optIdx}`}
              aria-selected={isSelected ? "true" : "false"}
              className={`${OPTION_BASE_CLASS} ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
              disabled={disabled}
              onClick={() => {
                if (multi) {
                  const next = selectedMulti.includes(optIdx)
                    ? selectedMulti.filter((v) => v !== optIdx)
                    : [...selectedMulti, optIdx];
                  emit({ answer: next, other: otherValue.trim() === "" ? null : otherValue });
                } else {
                  emit({ answer: isSelected ? null : optIdx, other: null });
                }
              }}
            >
              <div className="absolute inset-y-0 left-0 w-[72px] bg-option-card-accent group-aria-selected:bg-primary" />
              <div className="relative z-10 flex w-full items-center justify-between px-5 py-4">
                <div className="w-10 shrink-0" />
                <span className="text-[20px] font-semibold tracking-[0.2px] text-text-primary group-aria-selected:text-text-third">
                  {option}
                </span>
                <div className="flex w-10 shrink-0 items-center justify-center">
                  {isSelected && (
                    <div className="flex size-6 items-center justify-center rounded-full bg-white">
                      <Check className="size-4 [&>path]:stroke-primary" />
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {enableOtherOption && question.allow_other === true && (
        <div
          aria-selected={otherSelected ? "true" : "false"}
          className={`${OTHER_OPTION_BASE_CLASS} ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
          onClick={() => {
            if (disabled) return;
            if (multi) {
              emit({ answer: selectedMulti, other: otherSelected ? null : otherValue });
            } else {
              emit({ answer: null, other: otherValue });
            }
          }}
        >
          <div className="absolute inset-y-0 left-0 w-[72px] bg-option-card-accent group-aria-selected:bg-primary" />
          <div className="relative z-10 flex w-full items-center px-5 py-4">
            <div className="w-[64px] shrink-0" />
            <div className="flex-1 pr-4">
              <Input
                variant={InputVariant.Plain}
                className="h-11 w-full appearance-none border-0 bg-transparent px-0 text-left text-[18px] text-text-primary shadow-none outline-none ring-0 placeholder:text-text-primary-muted focus:border-transparent focus:outline-none focus:ring-0 focus-visible:border-transparent focus-visible:outline-none focus-visible:ring-0"
                placeholder={otherSelected ? tr.otherPlaceholder : ""}
                value={otherValue}
                disabled={disabled}
                onFocus={() => emit({ answer: multi ? selectedMulti : null, other: otherValue })}
                onChange={(e) => emit({ answer: multi ? selectedMulti : null, other: e.target.value })}
              />
            </div>
            <div className="flex w-10 shrink-0 items-center justify-center">
              {otherSelected && (
                <div className="flex size-6 items-center justify-center rounded-full bg-white">
                  <Check className="size-4 [&>path]:stroke-primary" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SubjectiveViewer({
  question,
  answer,
  disabled,
  onChange,
  isShort,
}: {
  question: { title: string; html_title?: string | null; description: string; is_required: boolean | null };
  answer?: Answer;
  disabled: boolean;
  onChange: (answer: Answer) => void;
  isShort: boolean;
}) {
  const tr = useQuestionViewerI18n();
  const currentValue =
    (answer?.answer_type === "short_answer" ? answer.answer : null) ??
    (answer?.answer_type === "subjective" ? answer.answer : null) ??
    "";

  const [draft, setDraft] = useState(currentValue);
  const [synced, setSynced] = useState(currentValue);
  useEffect(() => {
    if (synced !== currentValue) {
      setSynced(currentValue);
      setDraft(currentValue);
    }
  }, [currentValue, synced]);

  const emit = (value: string) => {
    onChange(isShort ? { answer_type: "short_answer", answer: value } : { answer_type: "subjective", answer: value });
  };

  return (
    <div className="flex w-full flex-col gap-[10px]">
      <QuestionTitle title={question.title} htmlTitle={question.html_title} description={question.description} isRequired={question.is_required} />
      {isShort ? (
        <Input
          variant={InputVariant.Plain}
          className="px-4 py-3 text-base rounded-lg border focus:border-yellow-500 focus:outline-none bg-input-box-bg border-input-box-border text-text-primary placeholder:text-neutral-600"
          placeholder={tr.subjectiveInputPlaceholder}
          disabled={disabled}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            emit(e.target.value);
          }}
        />
      ) : (
        <TextArea
          className="px-4 py-3 text-base rounded-lg border focus:border-yellow-500 focus:outline-none bg-input-box-bg border-input-box-border min-h-[185px] text-text-primary placeholder:text-neutral-600"
          placeholder={tr.subjectiveInputPlaceholder}
          disabled={disabled}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            emit(e.target.value);
          }}
        />
      )}
    </div>
  );
}

function CheckboxViewer({
  index,
  question,
  answer,
  disabled,
  onChange,
}: {
  index: number;
  question: { title: string; html_title?: string | null; description: string | null; options: string[]; is_multi: boolean; is_required: boolean | null };
  answer?: Answer;
  disabled: boolean;
  onChange: (answer: Answer) => void;
}) {
  const selected = answer?.answer_type === "checkbox" ? answer.answer ?? [] : [];

  return (
    <>
      <QuestionTitle title={question.title} htmlTitle={question.html_title} description={question.description} isRequired={question.is_required} />
      <div className="flex flex-col gap-2">
        {question.options.map((option, optIdx) => {
          const isSelected = selected.includes(optIdx);
          return (
            <button
              key={`checkbox-${index}-${optIdx}`}
              type="button"
              aria-selected={isSelected ? "true" : "false"}
              className="group flex w-full items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors border-input-box-border hover:border-border-subtle aria-selected:border-primary aria-selected:bg-primary/10"
              disabled={disabled}
              onClick={() => {
                let next: number[];
                if (question.is_multi) {
                  next = isSelected ? selected.filter((v) => v !== optIdx) : [...selected, optIdx];
                } else {
                  next = isSelected ? [] : [optIdx];
                }
                onChange({ answer_type: "checkbox", answer: next });
              }}
            >
              <div className="w-4 h-4 rounded border-2 flex items-center justify-center border-foreground-muted group-aria-selected:border-primary group-aria-selected:bg-primary">
                {isSelected && <Check className="size-3 [&>path]:stroke-white" />}
              </div>
              <span className="text-sm text-foreground-muted group-aria-selected:text-text-primary">{option}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function DropdownViewer({
  question,
  answer,
  disabled,
  onChange,
}: {
  question: { title: string; html_title?: string | null; description: string | null; options: string[]; is_required: boolean | null };
  answer?: Answer;
  disabled: boolean;
  onChange: (answer: Answer) => void;
}) {
  const selected = answer?.answer_type === "dropdown" ? answer.answer : null;

  return (
    <>
      <QuestionTitle title={question.title} htmlTitle={question.html_title} description={question.description} isRequired={question.is_required} />
      <select
        className="w-full p-3 rounded-lg border border-neutral-700 bg-neutral-900 text-white focus:border-blue-500 outline-none"
        disabled={disabled}
        value={selected === null ? "" : String(selected)}
        onChange={(e) => {
          const val = e.target.value;
          onChange({ answer_type: "dropdown", answer: val === "" ? null : Number.parseInt(val, 10) });
        }}
      >
        <option value="">Select...</option>
        {question.options.map((option, optIdx) => (
          <option key={`opt-${optIdx}`} value={optIdx}>
            {option}
          </option>
        ))}
      </select>
    </>
  );
}

function LinearScaleViewer({
  question,
  answer,
  disabled,
  onChange,
}: {
  question: {
    title: string;
    html_title?: string | null;
    description: string | null;
    is_required: boolean | null;
    min_value: number;
    max_value: number;
    min_label: string;
    max_label: string;
  };
  answer?: Answer;
  disabled: boolean;
  onChange: (answer: Answer) => void;
}) {
  const selected = answer?.answer_type === "linear_scale" ? answer.answer : null;
  const values: number[] = [];
  for (let v = question.min_value; v <= question.max_value; v += 1) values.push(v);

  return (
    <>
      <QuestionTitle title={question.title} htmlTitle={question.html_title} description={question.description} isRequired={question.is_required} />
      <div className="flex w-full flex-col gap-5 select-none">
        <div className="flex w-full items-center justify-between text-sm font-medium text-text-primary-muted">
          <span className="max-w-[40%] truncate">{question.min_label}</span>
          <span className="max-w-[40%] truncate text-right">{question.max_label}</span>
        </div>
        <div className="w-full">
          <div className="flex flex-wrap justify-center gap-2 px-1 pb-1">
            {values.map((val) => {
              const isSelected = selected === val;
              return (
                <button
                  key={`scale-${val}`}
                  type="button"
                  className={`flex size-10 shrink-0 items-center justify-center rounded-lg text-[15px] font-normal transition-colors ${
                    isSelected ? "bg-primary text-white" : "bg-neutral-700 text-white"
                  } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                  disabled={disabled}
                  onClick={() => onChange({ answer_type: "linear_scale", answer: val })}
                >
                  {val}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

interface PrivacyConsentQuestionShape {
  title: string;
  html_title?: string | null;
  description: string | null;
  terms_title: string;
  terms_body_html: string;
  is_required: boolean | null;
}

/** `respondent_from_panel_attributes`/`PrivacyConsentQuestion` flow — terms →
 * agree → phone input or prefilled-verified phone + "Change" → SMS verify.
 * The verified `code` rides in the `Answer` payload for `respond_poll`'s
 * server-side re-verification; it is never trusted on its own here. */
export function PrivacyConsentViewer({
  question,
  answer,
  disabled,
  onChange,
  hideTitle = false,
}: {
  question: PrivacyConsentQuestionShape;
  answer?: Answer;
  disabled: boolean;
  onChange: (answer: Answer) => void;
  /** The caller already renders the question title/description itself
   * (e.g. poll-viewer.tsx's question-card header) — skip the internal
   * QuestionTitle to avoid a duplicate. */
  hideTitle?: boolean;
}) {
  const tr = useQuestionViewerI18n();
  const myPhone = useGetMyPhone();
  const sendCode = useSendCode();
  const verifyCode = useVerifyCode();

  const agreed = answer?.answer_type === "privacy_consent" ? answer.agreed : false;
  const phone = answer?.answer_type === "privacy_consent" ? answer.phone : null;
  const code = answer?.answer_type === "privacy_consent" ? answer.code : null;

  const [phoneDraft, setPhoneDraft] = useState<PhoneInputValue | undefined>(undefined);
  const [codeDraft, setCodeDraft] = useState("");
  const [mode, setMode] = useState<"prefilled" | "entry">("entry");
  const [verifyError, setVerifyError] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const emit = (patch: { agreed?: boolean; phone?: string | null; code?: string | null }) => {
    onChange({
      answer_type: "privacy_consent",
      agreed: patch.agreed ?? agreed,
      phone: patch.phone !== undefined ? patch.phone : phone,
      code: patch.code !== undefined ? patch.code : code,
    });
  };

  useEffect(() => {
    if (initialized || myPhone.isLoading) return;
    const verifiedPhone = myPhone.data?.phone_number ?? null;
    if (verifiedPhone) {
      setMode("prefilled");
      if (phone === null) emit({ phone: verifiedPhone, code: "verified" });
    } else {
      setMode("entry");
    }
    setInitialized(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myPhone.isLoading, myPhone.data, initialized]);

  const isVerified = mode === "prefilled" ? phone !== null : code !== null && code !== "" && !verifyError;

  return (
    <div className="flex w-full flex-col gap-4" data-testid="poll-question-privacy-consent">
      {!hideTitle && (
        <QuestionTitle title={question.title} htmlTitle={question.html_title} description={question.description} isRequired={question.is_required} />
      )}

      <div
        className="rounded-xl border border-card-border bg-option-card-bg p-4 text-sm leading-relaxed text-foreground-muted max-h-56 overflow-y-auto"
        data-testid="pc-terms"
      >
        <div className="mb-1 text-text-primary font-semibold" data-testid="pc-terms-title">
          {question.terms_title}
        </div>
        <div className="ratel-editor" data-editable="false">
          <div className="re-content" dangerouslySetInnerHTML={{ __html: question.terms_body_html }} />
        </div>
      </div>

      <label className="flex items-start gap-2 rounded-xl border border-card-border bg-option-card-bg p-3 cursor-pointer">
        <input
          type="checkbox"
          data-testid="pc-agree-checkbox"
          checked={agreed}
          disabled={disabled}
          onChange={(e) => emit({ agreed: e.target.checked })}
        />
        <span className="text-sm text-text-primary">{tr.privacyConsentAgreeLabel}</span>
      </label>

      <div
        className={`flex flex-col gap-3 rounded-xl border p-4 transition-opacity ${
          agreed ? "border-primary/40 bg-primary/5" : "border-card-border bg-option-card-bg opacity-40 pointer-events-none"
        }`}
        data-testid="pc-phone-section"
        data-disabled={agreed ? "false" : "true"}
      >
        {mode === "prefilled" && phone !== null ? (
          <div className="flex items-center justify-between gap-2" data-testid="pc-prefill-row">
            <span className="font-semibold text-text-primary" data-testid="pc-prefill-number">
              {phone}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/10 px-2 py-1 text-xs font-semibold text-green-400" data-testid="pc-verified-pill">
              <Check className="size-3 [&>path]:stroke-green-400" />
              {tr.privacyConsentVerifiedLabel}
            </span>
            <Button
              buttonStyle={ButtonStyle.Outline}
              shape={ButtonShape.Square}
              disabled={disabled}
              data-testid="pc-change-btn"
              onClick={() => {
                setMode("entry");
                setPhoneDraft("");
                setCodeDraft("");
                emit({ phone: null, code: null });
              }}
            >
              {tr.privacyConsentChangeBtn}
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-text-primary-muted">
                {tr.privacyConsentPhoneLabel}
              </span>
              <div className="flex gap-2">
                <PhoneInput
                  placeholder={tr.privacyConsentPhonePlaceholder}
                  data-testid="pc-phone-input"
                  value={phoneDraft}
                  disabled={disabled}
                  onChange={setPhoneDraft}
                />
                <Button
                  buttonStyle={ButtonStyle.Outline}
                  shape={ButtonShape.Square}
                  disabled={disabled || !phoneDraft}
                  data-testid="pc-send-code-btn"
                  onClick={() => {
                    if (!phoneDraft) return;
                    sendCode.mutate({ phone: phoneDraft });
                    emit({ phone: phoneDraft, code: null });
                  }}
                >
                  {tr.privacyConsentSendCodeBtn}
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-text-primary-muted">
                {tr.privacyConsentCodeLabel}
              </span>
              <div className="flex gap-2">
                <Input
                  variant={InputVariant.Plain}
                  className="flex-1"
                  placeholder={tr.privacyConsentCodePlaceholder}
                  data-testid="pc-code-input"
                  value={codeDraft}
                  disabled={disabled}
                  onChange={(e) => setCodeDraft(e.target.value)}
                />
                <Button
                  buttonStyle={ButtonStyle.Outline}
                  shape={ButtonShape.Square}
                  disabled={disabled || codeDraft.trim() === "" || !phoneDraft}
                  data-testid="pc-verify-btn"
                  onClick={() => {
                    if (!phoneDraft) return;
                    verifyCode.mutate(
                      { phone: phoneDraft, code: codeDraft },
                      {
                        onSuccess: () => {
                          setVerifyError(false);
                          emit({ phone: phoneDraft, code: codeDraft });
                        },
                        onError: () => {
                          setVerifyError(true);
                          emit({ phone: phoneDraft, code: null });
                        },
                      },
                    );
                  }}
                >
                  {tr.privacyConsentVerifyBtn}
                </Button>
              </div>
              {verifyError && (
                <span className="text-xs text-red-400" data-testid="pc-verify-error">
                  {tr.privacyConsentVerifyError}
                </span>
              )}
            </div>
            <span
              className={`self-start inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${
                isVerified
                  ? "border-green-500/30 bg-green-500/10 text-green-400"
                  : "border-red-500/30 bg-red-500/10 text-red-400"
              }`}
              data-testid={isVerified ? "pc-verified-pill" : "pc-unverified-pill"}
            >
              {isVerified ? tr.privacyConsentVerifiedLabel : tr.privacyConsentNotVerifiedLabel}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
