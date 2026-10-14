import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Answer } from "@ratel/ts-bridges";
import { getEncryptionMaterial, respondPoll } from "@ratel/ts-bridges";
import { canExecuteSpaceAction, isParticipationOpen } from "@/components/space-actions/access";
import { FullActionLayover } from "@/components/space-actions/full-action-layover";
import { hasAnswerForQuestion, QuestionViewer, shouldAutoNext } from "@/components/space-actions/question-viewer";
import { useActionExecuteRole, useSpace, useSpaceContext } from "@/components/space/space-context";
import { Button, ButtonShape, ButtonStyle } from "@/components/ui/button";
import { usePollParticipantI18n } from "./poll-participant.i18n";
import { usePollReadI18n } from "./poll-read.i18n";
import {
  buildStoredVoterKeyFromEncryptionMaterial,
  encryptAnswersForCanister,
  loadSessionVoteSecret,
  saveSessionVoteSecret,
  saveStoredVoterKey,
} from "@/lib/poll-encryption";
import { usePopup } from "@/lib/popup";
import { timeAgo } from "@/lib/time";
import { useToast } from "@/lib/toast";
import { usePoll } from "../hooks/use-poll";
import { EncryptedVoteVerificationPanel, PollSubmitConfirmPopup } from "./poll-encrypted-vote";
import { applyAnswerChange, resolveNavigation, submissionAnswers } from "./poll-flow";
import { resolveTerminationCopy, usePollTerminationI18n, type TerminationCopy } from "./poll-termination.i18n";

// poll/views/main/poll_read_page.rs (`PollReadPage`, variant "read" — the
// participant flow: overview step + the client-side ABE encrypted-vote UI)
// and poll/views/main/participant/content.rs (`PollContent`, variant
// "content" — viewer + the legacy creator-after-lock view: no overview step,
// no encryption UI). Both share the same question-by-question response flow.
export function PollResponseView({ canRespond, variant }: { canRespond: boolean; variant: "read" | "content" }) {
  const trRead = usePollReadI18n();
  const trContent = usePollParticipantI18n();
  // Rust: PollReadPage uses PollReadTranslate; PollContent uses
  // PollParticipantTranslate. Both expose the same key set used here.
  const tr = variant === "read" ? trRead : trContent;
  const trTermination = usePollTerminationI18n();

  const toast = useToast();
  const popup = usePopup();
  const navigate = useNavigate();
  const { spaceId, pollId, poll, refresh } = usePoll();
  const space = useSpace();
  const role = useActionExecuteRole();
  const { restartRanking, restartMyScore } = useSpaceContext();
  const refreshScores = () => {
    void restartRanking();
    void restartMyScore();
  };

  const [step, setStep] = useState<"overview" | "poll">("overview");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, Answer>>(() => {
    const map: Record<number, Answer> = {};
    (poll.my_response ?? []).forEach((ans, i) => {
      map[i] = ans;
    });
    return map;
  });

  const canExecuteAction = canExecuteSpaceAction(
    role,
    poll.space_action.prerequisite,
    space.status,
    poll.space_action.status,
    true,
    isParticipationOpen(space),
  );

  const nav = useMemo(() => resolveNavigation(poll.questions, answers, questionIndex), [poll.questions, answers, questionIndex]);
  const { visibleIndices, currentIdx, prevIdx, nextIdx } = nav;

  const allAnswered = useMemo(() => {
    if (visibleIndices.length === 0) return false;
    return visibleIndices.every((idx) => hasAnswerForQuestion(poll.questions[idx], answers[idx]));
  }, [poll.questions, answers, visibleIndices]);

  const isInProgress = poll.status === "InProgress";
  const acceptsResponses = isInProgress || (role === "Creator" && poll.status === "NotStarted");
  const hasResponse = poll.my_response !== null;
  const canSubmit = canRespond && canExecuteAction && acceptsResponses && !hasResponse;
  const canUpdate = canRespond && canExecuteAction && acceptsResponses && hasResponse && poll.response_editable;
  const total = poll.questions.length;
  const currentQuestion = poll.questions[currentIdx];
  const currentAnswer = answers[currentIdx];
  const hasCurrentAnswer = currentQuestion !== undefined ? hasAnswerForQuestion(currentQuestion, currentAnswer) : false;
  const visiblePosition = nav.position;
  const isFirstQuestion = nav.isFirst;
  const isLastQuestion = nav.isLast;
  const pollNextDisabled = canSubmit && !hasCurrentAnswer;
  const showSubmitButton = canRespond && (canSubmit || canUpdate);

  // ── Encrypted voting (variant "read" only) ─────────────────────────────
  const encryptionEnabled = variant === "read" && poll.encrypted_upload_enabled;
  const [encryptionMaterial, setEncryptionMaterial] = useState<Awaited<ReturnType<typeof getEncryptionMaterial>> | null>(
    null,
  );
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const needsSecret = encryptionEnabled && canSubmit;

  const finalizeSecretSetup = async (secret: string) => {
    if (encryptionMaterial === null) return;
    try {
      const stored = await buildStoredVoterKeyFromEncryptionMaterial(encryptionMaterial, secret);
      saveStoredVoterKey(stored);
      saveSessionVoteSecret(secret);
      setClientSecret(secret);
    } catch (e) {
      toast.warn(e instanceof Error ? e.message : String(e));
    }
  };

  const openSecretSetupModal = () => {
    popup.open(
      <SecretSetupModal
        placeholder={trRead.encryptedSecretModalPlaceholder}
        continueLabel={trRead.encryptedSecretModalContinue}
        cancelLabel={trRead.encryptedSecretModalCancel}
        onContinue={(secret) => {
          if (secret === "") return;
          void finalizeSecretSetup(secret);
          popup.close();
        }}
        onCancel={() => popup.close()}
      />,
      { title: trRead.encryptedSecretModalTitle, description: trRead.encryptedSecretModalDescription },
    );
  };

  useEffect(() => {
    if (!needsSecret) return;
    let cancelled = false;
    void (async () => {
      let material = encryptionMaterial;
      if (material === null) {
        try {
          material = await getEncryptionMaterial(spaceId, pollId);
        } catch {
          toast.warn(trRead.encryptedMaterialLoadFailed);
          return;
        }
        if (cancelled) return;
        setEncryptionMaterial(material);
      }

      if (clientSecret === null) {
        const sessionSecret = loadSessionVoteSecret();
        if (sessionSecret !== null && sessionSecret !== "") {
          try {
            const stored = await buildStoredVoterKeyFromEncryptionMaterial(material, sessionSecret);
            saveStoredVoterKey(stored);
            saveSessionVoteSecret(sessionSecret);
            if (!cancelled) setClientSecret(sessionSecret);
          } catch (e) {
            if (!cancelled) toast.warn(e instanceof Error ? e.message : String(e));
          }
          return;
        }
        openSecretSetupModal();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsSecret]);

  const buildSubmitResponse = (current: Record<number, Answer> = answers) => {
    const payload: Answer[] = submissionAnswers(poll.questions, current);

    return async () => {
      let clientCiphertextJson: string | null = null;
      let clientVoterTag: string | null = null;

      if (encryptionEnabled) {
        if (encryptionMaterial === null || clientSecret === null) {
          toast.warn(trRead.encryptedSecretRequired);
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
        await respondPoll(spaceId, pollId, {
          answers: payload,
          client_ciphertext_json: clientCiphertextJson,
          client_voter_tag: clientVoterTag,
        });
        refresh();
        refreshScores();
        toast.info(tr.submitSuccess);
        navigate(`/spaces/${spaceId}/actions`, { replace: true });
      } catch (err) {
        toast.error(err);
      }
    };
  };

  const onSubmit = (current: Record<number, Answer> = answers) => {
    if (canSubmit && !poll.response_editable) {
      const confirmSubmit = buildSubmitResponse(current);
      popup.open(
        <PollSubmitConfirmPopup
          cancelLabel={tr.submitConfirmCancel}
          confirmLabel={tr.submitConfirmAction}
          testId={variant === "read" ? "poll-read-confirm-submit" : "poll-confirm-submit"}
          onCancel={() => popup.close()}
          onConfirm={() => {
            popup.close();
            void confirmSubmit();
          }}
        />,
        { title: tr.submitConfirmTitle, description: tr.submitConfirmDescription },
      );
    } else {
      void buildSubmitResponse(current)();
    }
  };

  const confirmTermination = (copy: TerminationCopy, terminated: Record<number, Answer>) => {
    popup.open(
      <PollSubmitConfirmPopup
        cancelLabel={trTermination.cancel}
        confirmLabel={copy.confirmLabel}
        destructive={copy.destructive}
        testId="poll-terminate-confirm"
        cancelTestId="poll-terminate-cancel"
        onCancel={() => popup.close()}
        onConfirm={() => {
          popup.close();
          setAnswers(terminated);
          void buildSubmitResponse(terminated)();
        }}
      />,
      { title: trTermination.title, description: copy.description },
    );
  };

  const onAnswerChange = (ans: Answer) => {
    const change = applyAnswerChange(poll.questions, answers, currentIdx, ans);
    if (change.terminated && (canSubmit || canUpdate)) {
      confirmTermination(resolveTerminationCopy(trTermination, currentQuestion!, ans, poll.response_editable), change.answers);
      return;
    }
    setAnswers(change.answers);
    if (canSubmit && change.upcomingIdx !== undefined && shouldAutoNext(currentQuestion!, ans)) {
      setQuestionIndex(change.upcomingIdx);
    }
  };

  const onCancel = () => navigate(`/spaces/${spaceId}/actions`);

  const emptyStateClass = variant === "read" ? "text-foreground-muted" : "text-neutral-500";

  if (variant === "read" && step === "overview") {
    return (
      <FullActionLayover
        data-testid="poll-read-overview"
        contentClassName="gap-6"
        bottomRight={
          <>
            <Button buttonStyle={ButtonStyle.Outline} shape={ButtonShape.Square} className="min-w-[120px]" onClick={onCancel}>
              {trRead.btnCancel}
            </Button>
            <Button
              buttonStyle={ButtonStyle.Primary}
              shape={ButtonShape.Square}
              className="min-w-[120px]"
              disabled={poll.questions.length === 0}
              data-testid="poll-read-next"
              onClick={() => {
                setQuestionIndex(0);
                setStep("poll");
              }}
            >
              {trRead.btnNext}
            </Button>
          </>
        }
      >
        <div className="w-full">
          <div className="font-bold text-[28px]/[34px] text-text-primary">{poll.title}</div>
          <div className="flex justify-end items-center py-4 border-y border-card-border">
            <div className="font-light shrink-0 text-[14px] text-text-primary">{timeAgo(poll.created_at)}</div>
          </div>
          {poll.description !== "" && (
            <div
              className="text-[15px]/[24px] tracking-[0.5px] text-foreground-muted"
              dangerouslySetInnerHTML={{ __html: poll.description }}
            />
          )}
        </div>
      </FullActionLayover>
    );
  }

  return (
    <FullActionLayover
      data-testid={variant === "read" ? "poll-read-poll" : undefined}
      bottomRight={
        <>
          {!isFirstQuestion && total > 0 && (
            <Button
              buttonStyle={ButtonStyle.Outline}
              shape={ButtonShape.Square}
              className="min-w-[120px]"
              data-testid="poll-prev"
              onClick={() => {
                if (prevIdx !== undefined) setQuestionIndex(prevIdx);
              }}
            >
              {tr.btnBack}
            </Button>
          )}
          {!isLastQuestion && total > 0 && (
            <Button
              buttonStyle={ButtonStyle.Outline}
              shape={ButtonShape.Square}
              className="min-w-[120px]"
              disabled={pollNextDisabled}
              data-testid="poll-next"
              onClick={() => {
                if (nextIdx !== undefined) setQuestionIndex(nextIdx);
              }}
            >
              {tr.btnNext}
            </Button>
          )}
          {isLastQuestion && showSubmitButton && total > 0 && (
            <Button
              buttonStyle={ButtonStyle.Primary}
              shape={ButtonShape.Square}
              className="min-w-[120px]"
              disabled={!allAnswered}
              data-testid="poll-submit"
              onClick={() => onSubmit()}
            >
              {canUpdate ? tr.btnUpdate : tr.btnSubmit}
            </Button>
          )}
        </>
      }
    >
      <div className="w-full">
        {poll.status === "Finish" && <div className="p-3 text-sm rounded-lg bg-banner-bg text-banner-text">{tr.pollEnded}</div>}
        {poll.status === "NotStarted" && (
          <div className="p-3 text-sm rounded-lg bg-banner-bg text-banner-text">{tr.pollNotStarted}</div>
        )}
        {isInProgress && !canExecuteAction && (
          <div className="p-3 text-sm rounded-lg bg-banner-bg text-banner-text">{tr.noPermission}</div>
        )}
        {isInProgress && canExecuteAction && hasResponse && !poll.response_editable && canRespond && (
          <div className="p-3 text-sm rounded-lg bg-banner-bg text-banner-text">{tr.alreadyResponded}</div>
        )}

        {variant === "read" && poll.encrypted_upload_enabled && hasResponse && canRespond && (
          <EncryptedVoteVerificationPanel spaceId={spaceId} pollId={pollId} />
        )}

        {total === 0 ? (
          <div className={`flex justify-center items-center py-10 ${emptyStateClass}`}>{tr.noQuestions}</div>
        ) : (
          <div key={`poll-question-${currentIdx}`} className="w-full" data-testid="poll-current-question" data-question-index={currentIdx}>
            <div className="flex justify-end items-center mb-5 font-normal text-[16px] text-text-primary" data-testid="poll-progress">
              {`${tr.questionLabel}: ${visiblePosition}/${visibleIndices.length}`}
            </div>
            <div className="w-full [&_[data-question-title-wrap]]:mb-5 [&_[data-question-title-wrap]>div]:justify-center [&_[data-question-title]]:text-center [&_[data-question-title]]:text-[21px] [&_[data-question-desc]]:text-center">
              <QuestionViewer
                index={currentIdx}
                total={total}
                question={currentQuestion!}
                answer={currentAnswer}
                disabled={!canRespond || !canExecuteAction || !acceptsResponses || (!canSubmit && !canUpdate)}
                enableOtherOption
                onChange={onAnswerChange}
              />
            </div>
          </div>
        )}
      </div>
    </FullActionLayover>
  );
}

function SecretSetupModal({
  placeholder,
  continueLabel,
  cancelLabel,
  onContinue,
  onCancel,
}: {
  placeholder: string;
  continueLabel: string;
  cancelLabel: string;
  onContinue: (secret: string) => void;
  onCancel: () => void;
}) {
  const [secret, setSecret] = useState("");
  return (
    <div className="flex flex-col gap-3 w-full">
      <input
        className="py-2 px-3 text-sm rounded-lg border border-card-border bg-background text-text-primary"
        type="password"
        placeholder={placeholder}
        data-testid="poll-encrypted-secret-input"
        value={secret}
        onChange={(e) => setSecret(e.target.value)}
      />
      <div className="flex gap-3 justify-end w-full">
        <Button buttonStyle={ButtonStyle.Outline} shape={ButtonShape.Square} className="min-w-[120px]" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button
          buttonStyle={ButtonStyle.Primary}
          shape={ButtonShape.Square}
          className="min-w-[120px]"
          data-testid="poll-encrypted-secret-continue"
          disabled={secret === ""}
          onClick={() => onContinue(secret)}
        >
          {continueLabel}
        </Button>
      </div>
    </div>
  );
}
