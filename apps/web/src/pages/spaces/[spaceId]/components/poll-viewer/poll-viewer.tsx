// app/ratel/src/features/spaces/pages/index/action_pages/poll/component.rs
// (`ActionPollViewer`) + its `{single_choice,multi_choice,checkbox_choice,
// dropdown_choice,linear_scale,subjective}/component.rs` question renderers.
//
// `SpaceIndexPage` mounts this inside
// `<div className="fixed inset-0 z-[100]" data-testid="poll-arena-overlay"><Suspense fallback={null}>`,
// so this component renders only `.poll-arena` and suspends on the poll query.
//
// Rust's encrypted-vote path (`encrypted_upload_enabled` polls — canister
// ABE encryption, session voter key derivation via PBKDF2,
// `poll-encrypted-secret-*` modal) is ported via `@/lib/poll-encryption`,
// whose CP-ABE step runs through the `attr-voting-wasm` wasm-bindgen module;
// see `doSubmit` below.
import * as React from "react";
import { useNavigate } from "react-router-dom";
import type { Answer, Question, SpacePartition, SpacePollEntityType, VoteEncryptionMaterialResponse } from "@ratel/ts-bridges";
import { useGetEncryptionMaterial, useGetPoll, useRespondPoll } from "@ratel/ts-bridges/hooks";
import { canExecuteSpaceAction, isParticipationOpen } from "@/components/space/access";
import { useActionOverlay, useCompletedActionCard, useOptionalActionOverlay } from "@/components/space/action-overlay";
import { useActionExecuteRole, useSpace, useSpaceContext } from "@/components/space/space-context";
import { PrivacyConsentViewer } from "@/components/space-actions/question-viewer";
import { useActionPollI18n } from "./i18n";
import {
  buildStoredVoterKeyFromEncryptionMaterial,
  encryptAnswersForCanister,
  loadSessionVoteSecret,
  saveSessionVoteSecret,
  saveStoredVoterKey,
} from "@/lib/poll-encryption";
import { useToast } from "@/lib/toast";
import { RichQuestionTitle } from "@/components/space-actions/rich-question-title";
import { applyAnswerChange, emptyAnswerFor, resolveNavigation, submissionAnswers } from "../../actions/polls/[pollId]/components/poll-flow";

type PollStep = "Overview" | "Poll";

/** Rust `should_auto_next`. */
function shouldAutoNext(question: Question, answer: Answer): boolean {
  if (question.answer_type === "single_choice" && answer.answer_type === "single_choice" && answer.answer !== null) return true;
  if (question.answer_type === "dropdown" && answer.answer_type === "dropdown" && answer.answer !== null) return true;
  if (question.answer_type === "linear_scale" && answer.answer_type === "linear_scale" && answer.answer !== null) return true;
  return false;
}

/** Rust `has_answer_for_question`. */
function hasAnswerForQuestion(question: Question, answer: Answer | undefined): boolean {
  if (!answer) return false;
  switch (question.answer_type) {
    case "single_choice":
      if (answer.answer_type !== "single_choice") return false;
      if (answer.other !== null) return answer.other.trim() !== "";
      return answer.answer !== null;
    case "multiple_choice":
      if (answer.answer_type !== "multiple_choice") return false;
      if (answer.other !== null) return answer.other.trim() !== "";
      return (answer.answer?.length ?? 0) > 0;
    case "short_answer":
      return answer.answer_type === "short_answer" && (answer.answer?.trim() ?? "") !== "";
    case "subjective":
      return answer.answer_type === "subjective" && (answer.answer?.trim() ?? "") !== "";
    case "checkbox":
      return answer.answer_type === "checkbox" && (answer.answer?.length ?? 0) > 0;
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

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

function BackIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
function NextIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function PollSingleChoice({
  idx,
  question,
  answer,
  disabled,
  onChange,
  otherPlaceholder,
}: {
  idx: number;
  question: Extract<Question, { answer_type: "single_choice" }>;
  answer: Answer | undefined;
  disabled: boolean;
  onChange: (a: Answer) => void;
  otherPlaceholder: string;
}) {
  const ans = answer?.answer_type === "single_choice" ? answer : null;
  const selected = ans?.answer ?? null;
  const otherValue = ans?.other ?? "";
  const otherSelected = ans !== null && ans.other !== null;
  const allowOther = question.allow_other ?? false;
  const otherLetter = LETTERS[question.options.length] ?? "?";

  return (
    <div className="options-single">
      {question.options.map((option, optIdx) => {
        const isSel = selected === optIdx;
        return (
          <div
            key={`sc-${idx}-${optIdx}`}
            className="option-single"
            data-testid={`poll-arena-option-${optIdx}`}
            data-selected={isSel ? "true" : "false"}
            data-disabled={disabled ? "true" : "false"}
            onClick={() => {
              if (!disabled) onChange({ answer_type: "single_choice", answer: isSel ? null : optIdx, other: null });
            }}
          >
            <span className="option-single__letter">{LETTERS[optIdx] ?? "?"}</span>
            <div className="option-single__radio">
              <div className="option-single__radio-dot" />
            </div>
            <span className="option-single__label">{option}</span>
          </div>
        );
      })}
      {allowOther && (
        <div
          key={`sc-${idx}-other`}
          className="option-single"
          data-selected={otherSelected ? "true" : "false"}
          data-disabled={disabled ? "true" : "false"}
          onClick={() => {
            if (!disabled) onChange({ answer_type: "single_choice", answer: null, other: otherValue });
          }}
        >
          <span className="option-single__letter">{otherLetter}</span>
          <div className="option-single__radio">
            <div className="option-single__radio-dot" />
          </div>
          <input
            type="text"
            className="option-single__other-input"
            placeholder={otherPlaceholder}
            disabled={disabled}
            value={otherValue}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onChange({ answer_type: "single_choice", answer: null, other: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}

function PollMultipleChoice({
  idx,
  question,
  answer,
  disabled,
  onChange,
  otherPlaceholder,
}: {
  idx: number;
  question: Extract<Question, { answer_type: "multiple_choice" }>;
  answer: Answer | undefined;
  disabled: boolean;
  onChange: (a: Answer) => void;
  otherPlaceholder: string;
}) {
  const ans = answer?.answer_type === "multiple_choice" ? answer : null;
  const selected = ans?.answer ?? [];
  const otherValue = ans?.other ?? "";
  const otherSelected = ans !== null && ans.other !== null;
  const allowOther = question.allow_other ?? false;

  return (
    <div className="options-multi">
      {question.options.map((option, optIdx) => {
        const isSel = selected.includes(optIdx);
        return (
          <div
            key={`mc-${idx}-${optIdx}`}
            className="option-multi"
            data-testid={`poll-arena-option-${optIdx}`}
            data-selected={isSel ? "true" : "false"}
            data-disabled={disabled ? "true" : "false"}
            onClick={() => {
              if (disabled) return;
              const next = isSel ? selected.filter((x) => x !== optIdx) : [...selected, optIdx];
              onChange({ answer_type: "multiple_choice", answer: next, other: otherValue.trim() === "" ? null : otherValue });
            }}
          >
            <div className="option-multi__checkbox">
              <span className="option-multi__check">
                <CheckIcon />
              </span>
            </div>
            <span className="option-multi__label">{option}</span>
          </div>
        );
      })}
      {allowOther && (
        <div
          key={`mc-${idx}-other`}
          className="option-multi"
          data-selected={otherSelected ? "true" : "false"}
          data-disabled={disabled ? "true" : "false"}
          onClick={() => {
            if (disabled) return;
            onChange({ answer_type: "multiple_choice", answer: selected, other: otherSelected ? null : otherValue });
          }}
        >
          <div className="option-multi__checkbox">
            <span className="option-multi__check">
              <CheckIcon />
            </span>
          </div>
          <input
            type="text"
            className="option-multi__other-input"
            placeholder={otherPlaceholder}
            disabled={disabled}
            value={otherValue}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onChange({ answer_type: "multiple_choice", answer: selected, other: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}

function PollCheckbox({
  idx,
  question,
  answer,
  disabled,
  onChange,
}: {
  idx: number;
  question: Extract<Question, { answer_type: "checkbox" }>;
  answer: Answer | undefined;
  disabled: boolean;
  onChange: (a: Answer) => void;
}) {
  const selected = (answer?.answer_type === "checkbox" ? answer.answer : null) ?? [];
  return (
    <div className="options-multi">
      {question.options.map((option, optIdx) => {
        const isSel = selected.includes(optIdx);
        return (
          <div
            key={`cb-${idx}-${optIdx}`}
            className="option-multi"
            data-selected={isSel ? "true" : "false"}
            data-disabled={disabled ? "true" : "false"}
            onClick={() => {
              if (disabled) return;
              let next: number[];
              if (question.is_multi) {
                next = isSel ? selected.filter((x) => x !== optIdx) : [...selected, optIdx];
              } else {
                next = isSel ? [] : [optIdx];
              }
              onChange({ answer_type: "checkbox", answer: next });
            }}
          >
            <div className="option-multi__checkbox">
              <span className="option-multi__check">
                <CheckIcon />
              </span>
            </div>
            <span className="option-multi__label">{option}</span>
          </div>
        );
      })}
    </div>
  );
}

function PollDropdown({
  question,
  answer,
  disabled,
  onChange,
}: {
  question: Extract<Question, { answer_type: "dropdown" }>;
  answer: Answer | undefined;
  disabled: boolean;
  onChange: (a: Answer) => void;
}) {
  const selected = answer?.answer_type === "dropdown" ? answer.answer : null;
  return (
    <select
      className="subjective-input"
      disabled={disabled}
      value={selected ?? ""}
      onChange={(e) => onChange({ answer_type: "dropdown", answer: e.target.value === "" ? null : Number(e.target.value) })}
    >
      <option value="">Select...</option>
      {question.options.map((opt, oi) => (
        <option key={oi} value={oi}>
          {opt}
        </option>
      ))}
    </select>
  );
}

function PollLinearScale({
  idx,
  question,
  answer,
  disabled,
  onChange,
}: {
  idx: number;
  question: Extract<Question, { answer_type: "linear_scale" }>;
  answer: Answer | undefined;
  disabled: boolean;
  onChange: (a: Answer) => void;
}) {
  const selected = answer?.answer_type === "linear_scale" ? answer.answer : null;
  const values: number[] = [];
  for (let v = question.min_value; v <= question.max_value; v += 1) values.push(v);
  return (
    <div className="scale-wrap">
      <div className="scale-labels">
        <span className="scale-label scale-label--min">{question.min_label}</span>
        <span className="scale-label scale-label--max">{question.max_label}</span>
      </div>
      <div className="scale-track">
        {values.map((val) => {
          const isSel = selected === val;
          const inRange = selected !== null && val < selected && val >= question.min_value;
          return (
            <button
              key={`sc-${idx}-${val}`}
              className="scale-point"
              data-selected={isSel ? "true" : "false"}
              data-in-range={inRange ? "true" : "false"}
              data-disabled={disabled ? "true" : "false"}
              disabled={disabled}
              onClick={() => onChange({ answer_type: "linear_scale", answer: val })}
            >
              {val}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PollSubjective({
  answer,
  disabled,
  isShort,
  onChange,
  placeholder,
}: {
  question: Extract<Question, { answer_type: "short_answer" | "subjective" }>;
  answer: Answer | undefined;
  disabled: boolean;
  isShort: boolean;
  onChange: (a: Answer) => void;
  placeholder: string;
}) {
  const current =
    (answer?.answer_type === "short_answer" ? answer.answer : answer?.answer_type === "subjective" ? answer.answer : null) ?? "";
  const [draft, setDraft] = React.useState(current);
  const synced = React.useRef(current);
  React.useEffect(() => {
    if (synced.current !== current) {
      synced.current = current;
      setDraft(current);
    }
  }, [current]);

  return (
    <div className="subjective-wrap">
      {isShort ? (
        <input
          className="subjective-input"
          type="text"
          placeholder={placeholder}
          disabled={disabled}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            onChange({ answer_type: "short_answer", answer: e.target.value });
          }}
        />
      ) : (
        <>
          <textarea
            className="subjective-textarea"
            placeholder={placeholder}
            disabled={disabled}
            value={draft}
            maxLength={2000}
            onChange={(e) => {
              setDraft(e.target.value);
              onChange({ answer_type: "subjective", answer: e.target.value });
            }}
          />
          <span className="subjective-counter">{`${draft.length} / 2000`}</span>
        </>
      )}
    </div>
  );
}

export interface ActionPollViewerProps {
  spaceId: SpacePartition;
  pollId: SpacePollEntityType;
  canRespond: boolean;
}

export function ActionPollViewer({ spaceId, pollId, canRespond }: ActionPollViewerProps) {
  const tr = useActionPollI18n();
  const toast = useToast();
  const spaceCtx = useSpaceContext();
  const role = useActionExecuteRole();
  const space = useSpace();
  const overlayCtx = useOptionalActionOverlay();
  const overlay = useActionOverlay();
  const completed = useCompletedActionCard();
  const navigate = useNavigate();

  const { data: poll } = useGetPoll(spaceId, pollId, { staleTime: 0 });
  const respondPoll = useRespondPoll();

  const [step, setStep] = React.useState<PollStep>("Overview");
  const [questionIndex, setQuestionIndex] = React.useState(0);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [answers, setAnswers] = React.useState<Record<number, Answer>>({});

  React.useEffect(() => {
    if (!poll) return;
    const base: Record<number, Answer> = {};
    poll.questions.forEach((q, i) => {
      base[i] = poll.my_response?.[i] ?? emptyAnswerFor(q);
    });
    setAnswers(base);
    // Re-seed only when the poll identity/response set changes, like Rust's
    // one-shot `use_signal(|| initial_answers)`.
  }, [poll?.sk, poll?.my_response]);

  const encryptionEnabled = poll?.encrypted_upload_enabled ?? false;
  const [clientSecret, setClientSecret] = React.useState<string | null>(null);
  const [secretInput, setSecretInput] = React.useState("");
  const [showSecretModal, setShowSecretModal] = React.useState(false);
  const [applyingSecret, setApplyingSecret] = React.useState(false);

  const canSubmitForSecret = poll ? canRespond && canExecuteSpaceAction(role, poll.space_action.prerequisite, space.status, poll.space_action.status, true, isParticipationOpen(space)) && (poll.status === "InProgress" || (role === "Creator" && poll.status === "NotStarted")) && poll.my_response === null : false;
  const needsSecret = encryptionEnabled && canSubmitForSecret;
  const materialQuery = useGetEncryptionMaterial(spaceId, pollId, { enabled: needsSecret });
  const encryptionMaterial: VoteEncryptionMaterialResponse | undefined = materialQuery.data;
  const loadingMaterial = materialQuery.isLoading;

  // Kick off the (slow) keygen request and decide whether to prompt the
  // user. Mirrors Rust's first `use_effect` in `ActionPollViewer`.
  React.useEffect(() => {
    if (!needsSecret) return;
    const sessionSecret = loadSessionVoteSecret() ?? "";
    if (sessionSecret !== "" && clientSecret === null) {
      setSecretInput(sessionSecret);
    } else if (clientSecret === null) {
      setShowSecretModal(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsSecret]);

  // Auto-finalize when both material and a (session-derived) secret are
  // present without the modal being shown. Mirrors Rust's second `use_effect`.
  React.useEffect(() => {
    if (clientSecret !== null || showSecretModal) return;
    if (!encryptionMaterial || secretInput === "") return;
    buildStoredVoterKeyFromEncryptionMaterial(encryptionMaterial, secretInput)
      .then((stored) => {
        saveStoredVoterKey(stored);
        setClientSecret(secretInput);
      })
      .catch((e) => toast.warn(e instanceof Error ? e.message : String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientSecret, showSecretModal, encryptionMaterial, secretInput]);

  if (!poll) return null;

  const questions = poll.questions;
  const total = questions.length;

  const canExecuteAction = canExecuteSpaceAction(role, poll.space_action.prerequisite, space.status, poll.space_action.status, true, isParticipationOpen(space));
  const isInProgress = poll.status === "InProgress";
  const isNotStarted = poll.status === "NotStarted";
  const acceptsResponses = isInProgress || (role === "Creator" && isNotStarted);
  const hasResponse = poll.my_response !== null;
  const canSubmit = canRespond && canExecuteAction && acceptsResponses && !hasResponse;
  const canUpdate = canRespond && canExecuteAction && acceptsResponses && hasResponse && poll.response_editable;
  const showSubmit = canRespond && (canSubmit || canUpdate);
  const disabled = !canRespond || !canExecuteAction || !acceptsResponses || (!canSubmit && !canUpdate);

  const nav = resolveNavigation(questions, answers, questionIndex);
  const { currentIdx, prevIdx, nextIdx, isFirst, isLast, visibleIndices } = nav;
  const allAnswered = visibleIndices.length > 0 && visibleIndices.every((i) => hasAnswerForQuestion(questions[i], answers[i]));
  const currentQuestion = questions[currentIdx];
  const hasCurrentAnswer = currentQuestion ? hasAnswerForQuestion(currentQuestion, answers[currentIdx]) : false;
  const nextDisabled = canSubmit && !hasCurrentAnswer;

  const goBack = () => {
    if (overlayCtx) {
      overlay.setOverlay(null);
    } else {
      navigate(`/spaces/${spaceId}`);
    }
  };

  const doSubmit = async (current: Record<number, Answer> = answers) => {
    const payload = submissionAnswers(questions, current);
    let clientCiphertextJson: string | null = null;
    let clientVoterTag: string | null = null;

    if (poll.encrypted_upload_enabled) {
      if (!encryptionMaterial || clientSecret === null) {
        toast.warn(tr.encryptedSecretRequired);
        setShowSecretModal(true);
        return;
      }
      try {
        const enc = await encryptAnswersForCanister(encryptionMaterial, payload, Date.now());
        clientCiphertextJson = enc.ciphertext_json;
        clientVoterTag = enc.voter_tag;
      } catch (e) {
        toast.warn(e instanceof Error ? e.message : String(e));
        return;
      }
    }

    try {
      await respondPoll.mutateAsync({
        spacePk: spaceId,
        pollSk: pollId,
        req: { answers: payload, client_ciphertext_json: clientCiphertextJson, client_voter_tag: clientVoterTag },
      });
    } catch (err) {
      toast.error(err);
      return;
    }
    void spaceCtx.restartRanking();
    void spaceCtx.restartMyScore();
    void spaceCtx.restartActions();
    toast.info(tr.submitSuccess);
    if (overlayCtx) {
      completed.setCompleted(pollId);
      overlay.setOverlay(null);
    } else {
      navigate(`/spaces/${spaceId}`);
    }
  };

  const onSubmitClick = (current: Record<number, Answer> = answers) => {
    if (canSubmit && !poll.response_editable) {
      setShowConfirm(true);
    } else {
      void doSubmit(current);
    }
  };

  const onAnswerChange = (idx: number, question: Question, ans: Answer) => {
    const change = applyAnswerChange(questions, answers, idx, ans);
    setAnswers(change.answers);
    if (change.terminated && (canSubmit || canUpdate)) {
      onSubmitClick(change.answers);
      return;
    }
    if (canSubmit && change.upcomingIdx !== undefined && shouldAutoNext(question, ans)) {
      setQuestionIndex(change.upcomingIdx);
    }
  };

  const statusText = poll.status === "InProgress" ? tr.inProgress : poll.status === "NotStarted" ? tr.notStarted : tr.finished;
  const statusClass =
    poll.status === "InProgress"
      ? "poll-header__status"
      : poll.status === "NotStarted"
        ? "poll-header__status poll-header__status--not-started"
        : "poll-header__status poll-header__status--finished";

  const renderQuestion = (question: Question, idx: number) => {
    const currentAnswer = answers[idx];
    const onChange = (ans: Answer) => onAnswerChange(idx, question, ans);
    switch (question.answer_type) {
      case "single_choice":
        return (
          <PollSingleChoice
            idx={idx}
            question={question}
            answer={currentAnswer}
            disabled={disabled}
            otherPlaceholder={tr.otherPlaceholder}
            onChange={onChange}
          />
        );
      case "multiple_choice":
        return (
          <PollMultipleChoice
            idx={idx}
            question={question}
            answer={currentAnswer}
            disabled={disabled}
            otherPlaceholder={tr.otherPlaceholder}
            onChange={onChange}
          />
        );
      case "subjective":
        return (
          <PollSubjective
            question={question}
            answer={currentAnswer}
            disabled={disabled}
            isShort={false}
            placeholder={tr.subjectivePlaceholder}
            onChange={onChange}
          />
        );
      case "short_answer":
        return (
          <PollSubjective
            question={question}
            answer={currentAnswer}
            disabled={disabled}
            isShort
            placeholder={tr.subjectivePlaceholder}
            onChange={onChange}
          />
        );
      case "linear_scale":
        return (
          <PollLinearScale
            idx={idx}
            question={question}
            answer={currentAnswer}
            disabled={disabled}
            onChange={onChange}
          />
        );
      case "checkbox":
        return (
          <PollCheckbox
            idx={idx}
            question={question}
            answer={currentAnswer}
            disabled={disabled}
            onChange={onChange}
          />
        );
      case "dropdown":
        return (
          <PollDropdown
            question={question}
            answer={currentAnswer}
            disabled={disabled}
            onChange={onChange}
          />
        );
      case "privacy_consent":
        return (
          <PrivacyConsentViewer
            question={question}
            answer={currentAnswer}
            disabled={disabled}
            hideTitle
            onChange={onChange}
          />
        );
    }
  };

  const isRequired = (question: Question): boolean => question.is_required ?? false;
  const questionDesc = (question: Question): string | null => {
    const d = "description" in question ? question.description : null;
    return d && d !== "" ? d : null;
  };
  const questionImage = (question: Question): string | null => {
    if (
      question.answer_type === "short_answer" ||
      question.answer_type === "subjective" ||
      question.answer_type === "privacy_consent"
    ) {
      return null;
    }
    return question.image_url && question.image_url !== "" ? question.image_url : null;
  };

  return (
    <div className="poll-arena">
      <div className="poll-header">
        <div className="poll-header__left">
          <button className="poll-header__back" onClick={goBack}>
            <BackIcon />
          </button>
          <div className="poll-header__info">
            <span className="poll-header__type">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18" />
                <path d="M7 16h4v-6H7z" />
                <path d="M13 16h4V8h-4z" />
              </svg>
              {tr.pollType}
            </span>
            <span className="poll-header__title">{poll.title}</span>
          </div>
        </div>
        <div className="poll-header__right">
          {step === "Poll" && total > 0 && (
            <span className="poll-header__counter" data-testid="poll-arena-progress">{`${nav.position}/${visibleIndices.length}`}</span>
          )}
          <span className={statusClass}>{statusText}</span>
          {poll.space_action.activity_score > 0 && (
            <span className="poll-header__reward">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              {`+${poll.space_action.activity_score} ${tr.ptsSuffix}`}
            </span>
          )}
        </div>
      </div>

      {poll.status === "Finish" && <div className="poll-banner poll-banner--info">{tr.pollEnded}</div>}
      {poll.status === "NotStarted" && <div className="poll-banner poll-banner--info">{tr.pollNotStarted}</div>}
      {acceptsResponses && !canExecuteAction && <div className="poll-banner poll-banner--warning">{tr.noPermission}</div>}
      {acceptsResponses && canExecuteAction && hasResponse && !poll.response_editable && canRespond && (
        <div className="poll-banner poll-banner--info">{tr.alreadyResponded}</div>
      )}

      {step === "Overview" && (
        <div className="poll-overview" data-testid="poll-arena-overview">
          <div className="poll-overview-ring">
            <svg className="poll-overview-ring__svg" viewBox="0 0 140 140">
              <circle className="poll-overview-ring__bg" cx="70" cy="70" r="60" />
              <circle className="poll-overview-ring__fill" cx="70" cy="70" r="60" />
            </svg>
            <div className="poll-overview-ring__center">
              <span className="poll-overview-ring__number">{total}</span>
              <span className="poll-overview-ring__label">{tr.questionsLabel}</span>
            </div>
          </div>

          <div className="poll-overview-card">
            <div className="poll-overview-card__title">{poll.title}</div>
            {poll.description !== "" && <div className="poll-overview-card__desc" dangerouslySetInnerHTML={{ __html: poll.description }} />}

            <div className="poll-overview-stats">
              <div className="poll-overview-stat">
                <span className="poll-overview-stat__value">{total}</span>
                <span className="poll-overview-stat__label">{tr.questionsLabel}</span>
              </div>
              {poll.space_action.activity_score > 0 && (
                <div className="poll-overview-stat">
                  <span className="poll-overview-stat__value">{`+${poll.space_action.activity_score}`}</span>
                  <span className="poll-overview-stat__label">{tr.rewardLabel}</span>
                </div>
              )}
              {poll.space_action.credits > 0 && (
                <div className="poll-overview-stat">
                  <span className="poll-overview-stat__value">{poll.space_action.credits}</span>
                  <span className="poll-overview-stat__label">{tr.creditsLabel}</span>
                </div>
              )}
            </div>

            <button
              className="poll-begin-btn"
              data-testid="poll-arena-begin"
              disabled={total === 0 || (isNotStarted && !acceptsResponses)}
              onClick={() => {
                setQuestionIndex(0);
                setStep("Poll");
              }}
            >
              {tr.beginPoll}
            </button>
          </div>
        </div>
      )}

      {step === "Poll" && total === 0 && (
        <div className="question-stage">
          <div className="question-card">
            <span className="question-card__desc">{tr.noQuestions}</span>
          </div>
        </div>
      )}

      {step === "Poll" && total > 0 && currentQuestion && (
        <div key={`poll-q-${currentIdx}`} className="question-stage" data-testid="poll-arena-question" data-question-index={currentIdx}>
          <div className="question-card">
            <div className="question-card__number">
              {`${tr.questionPrefix} ${String(nav.position).padStart(2, "0")}`}
              {isRequired(currentQuestion) && <span className="question-card__required">{tr.required}</span>}
            </div>
            {currentQuestion.html_title ? (
              <RichQuestionTitle html={currentQuestion.html_title} />
            ) : (
              <h2 className="question-card__title">{currentQuestion.title}</h2>
            )}
            {questionDesc(currentQuestion) && <p className="question-card__desc">{questionDesc(currentQuestion)}</p>}
            {questionImage(currentQuestion) && <img className="question-card__image" src={questionImage(currentQuestion) ?? ""} alt="Question image" />}
            {renderQuestion(currentQuestion, currentIdx)}
          </div>
        </div>
      )}

      {step === "Poll" && (
        <div className="poll-footer">
          <div className="poll-footer__right">
            {!isFirst && total > 0 && (
              <button className="poll-btn poll-btn--back" data-testid="poll-arena-prev" onClick={() => prevIdx !== undefined && setQuestionIndex(prevIdx)}>
                <BackIcon />
                {tr.btnBack}
              </button>
            )}
            {!isLast && total > 0 && (
              <button
                className="poll-btn poll-btn--next"
                data-testid="poll-arena-next"
                disabled={nextDisabled}
                onClick={() => nextIdx !== undefined && setQuestionIndex(nextIdx)}
              >
                {tr.btnNext}
                <NextIcon />
              </button>
            )}
            {isLast && showSubmit && total > 0 && (
              <button className="poll-btn poll-btn--submit" data-testid="poll-submit" disabled={!allAnswered} onClick={() => onSubmitClick()}>
                {canUpdate ? tr.btnUpdate : tr.btnSubmit}
                <CheckIcon />
              </button>
            )}
          </div>
        </div>
      )}

      {showConfirm && (
        <div className="poll-confirm-overlay" onClick={() => setShowConfirm(false)}>
          <div className="poll-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="poll-confirm-modal__icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h3 className="poll-confirm-modal__title">{tr.submitConfirmTitle}</h3>
            <p className="poll-confirm-modal__desc">{tr.submitConfirmDesc}</p>
            <div className="poll-confirm-modal__actions">
              <button className="poll-btn poll-btn--back" onClick={() => setShowConfirm(false)}>
                {tr.submitConfirmCancel}
              </button>
              <button
                className="poll-btn poll-btn--submit"
                data-testid="poll-confirm-submit"
                onClick={() => {
                  setShowConfirm(false);
                  void doSubmit();
                }}
              >
                {tr.submitConfirmAction}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSecretModal && (
        <div className="poll-confirm-overlay">
          <div className="poll-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="poll-confirm-modal__title">{tr.encryptedSecretTitle}</h3>
            <p className="poll-confirm-modal__desc">{tr.encryptedSecretDescription}</p>
            <input
              data-testid="poll-encrypted-secret-input"
              type="password"
              placeholder={tr.encryptedSecretPlaceholder}
              value={secretInput}
              disabled={applyingSecret}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid var(--color-card-border, #2a2a3a)",
                background: "var(--color-input-box-bg, #0c0c1a)",
                color: "var(--color-text-primary, #f0f0f5)",
                fontSize: "14px",
                margin: "12px 0",
              }}
              onChange={(e) => setSecretInput(e.target.value)}
            />
            {loadingMaterial && !encryptionMaterial && (
              <div
                data-testid="poll-encrypted-material-loading"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: "var(--color-foreground-muted, #8888a8)",
                  fontSize: "13px",
                  margin: "4px 0 12px",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: "14px",
                    height: "14px",
                    border: "2px solid currentColor",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
                {tr.encryptedMaterialLoading}
              </div>
            )}
            {applyingSecret && (
              <div
                data-testid="poll-encrypted-secret-applying"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: "var(--color-foreground-muted, #8888a8)",
                  fontSize: "13px",
                  margin: "4px 0 12px",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: "14px",
                    height: "14px",
                    border: "2px solid currentColor",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
                {tr.encryptedSecretApplying}
              </div>
            )}
            <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
            <div className="poll-confirm-modal__actions">
              <button
                className="poll-btn poll-btn--back"
                disabled={applyingSecret}
                onClick={() => {
                  setSecretInput("");
                  setShowSecretModal(false);
                  if (overlayCtx) {
                    overlay.setOverlay(null);
                  } else {
                    navigate(`/spaces/${spaceId}`);
                  }
                }}
              >
                {tr.encryptedSecretCancel}
              </button>
              <button
                className="poll-btn poll-btn--submit"
                data-testid="poll-encrypted-secret-continue"
                disabled={secretInput === "" || loadingMaterial || !encryptionMaterial || applyingSecret}
                onClick={() => {
                  void (async () => {
                    const s = secretInput;
                    if (s === "") return;
                    if (!encryptionMaterial) {
                      toast.warn(tr.encryptedMaterialLoadFailed);
                      return;
                    }
                    setApplyingSecret(true);
                    // Yield once so the disabled/"Applying…" state paints
                    // before PBKDF2 blocks the main thread briefly.
                    await new Promise((resolve) => setTimeout(resolve, 0));
                    try {
                      const stored = await buildStoredVoterKeyFromEncryptionMaterial(encryptionMaterial, s);
                      saveStoredVoterKey(stored);
                      saveSessionVoteSecret(s);
                      setClientSecret(s);
                      setSecretInput("");
                      setShowSecretModal(false);
                    } catch (e) {
                      toast.warn(e instanceof Error ? e.message : String(e));
                    }
                    setApplyingSecret(false);
                  })();
                }}
              >
                {applyingSecret ? tr.encryptedSecretApplying : tr.encryptedSecretContinue}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
