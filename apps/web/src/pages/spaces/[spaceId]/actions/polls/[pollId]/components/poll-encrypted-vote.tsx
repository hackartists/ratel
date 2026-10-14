import { useEffect, useState } from "react";
import { getVoteVerificationMaterial } from "@ratel/ts-bridges";
import { Button, ButtonShape, ButtonStyle } from "@/components/ui/button";
import { usePollReadI18n } from "./poll-read.i18n";
import {
  buildStoredVoterKey,
  loadSessionVoteSecret,
  saveSessionVoteSecret,
  saveStoredVoterKey,
  verifyClientVoteMaterial,
} from "@/lib/poll-encryption";
import { useToast } from "@/lib/toast";

// poll_read_page.rs (`EncryptedVoteVerificationPanel`, `PollReadSubmitConfirm`).

export function EncryptedVoteVerificationPanel({ spaceId, pollId }: { spaceId: string; pollId: string }) {
  const tr = usePollReadI18n();
  const toast = useToast();
  const [secret, setSecret] = useState("");
  const [secretFromSession, setSecretFromSession] = useState(false);
  const [showSecretInput, setShowSecretInput] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [decrypted, setDecrypted] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedSecret = loadSessionVoteSecret();
    if (savedSecret !== null && savedSecret !== "" && secret === "") {
      setSecret(savedSecret);
      setSecretFromSession(true);
      setShowSecretInput(false);
    }
    // Runs once on mount, like the Rust `onmounted` handler.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onVerify = () => {
    if (secret === "") {
      setError(tr.encryptedVerifySecretPlaceholder);
      return;
    }
    setVerifying(true);
    setError(null);
    setDecrypted(null);

    void (async () => {
      try {
        const material = await getVoteVerificationMaterial(spaceId, pollId);
        const stored = await buildStoredVoterKey(material, secret);
        saveStoredVoterKey(stored);
        const verified = await verifyClientVoteMaterial(material, stored, secret);
        saveSessionVoteSecret(secret);
        setVerifying(false);
        setSecretFromSession(true);
        setShowSecretInput(false);
        setDecrypted(verified.decrypted_choice);
        toast.info(tr.encryptedVerifySuccess);
      } catch (err) {
        setVerifying(false);
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        toast.warn(message);
      }
    })();
  };

  return (
    <div className="flex flex-col gap-3 p-4 my-4 rounded-xl border border-card-border bg-card-bg">
      <div className="flex flex-col gap-1">
        <div className="font-semibold text-[15px] text-text-primary">{tr.encryptedVerifyTitle}</div>
        <div className="text-[13px]/[20px] text-foreground-muted">{tr.encryptedVerifyDescription}</div>
        <div className="text-[13px]/[20px] text-foreground-muted">{tr.encryptedVerifySessionDescription}</div>
      </div>
      {secretFromSession && !showSecretInput ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex-1 py-2 px-3 text-sm rounded-lg border border-card-border bg-background text-foreground-muted">
            {tr.encryptedVerifySessionActive}
          </div>
          <Button
            buttonStyle={ButtonStyle.Secondary}
            shape={ButtonShape.Square}
            className="min-w-[140px]"
            disabled={verifying}
            onClick={() => {
              setSecret("");
              setSecretFromSession(false);
              setShowSecretInput(true);
            }}
          >
            {tr.encryptedVerifyChangeSecret}
          </Button>
        </div>
      ) : (
        <input
          className="py-2 px-3 text-sm rounded-lg border border-card-border bg-background text-text-primary"
          type="password"
          value={secret}
          placeholder={tr.encryptedVerifySecretPlaceholder}
          onChange={(e) => {
            setSecret(e.target.value);
            setSecretFromSession(false);
          }}
        />
      )}
      <div className="flex justify-end">
        <Button
          buttonStyle={ButtonStyle.Primary}
          shape={ButtonShape.Square}
          className="min-w-[160px]"
          disabled={verifying}
          onClick={onVerify}
        >
          {tr.encryptedVerifyButton}
        </Button>
      </div>
      {error !== null && (
        <div className="text-red-500 text-[13px]/[20px]">
          {tr.encryptedVerifyError}: {error}
        </div>
      )}
      {decrypted !== null && (
        <div className="flex flex-col gap-2">
          <div className="font-semibold text-[13px] text-text-primary">{tr.encryptedVerifyDecrypted}</div>
          <pre className="overflow-auto p-3 max-h-48 text-xs whitespace-pre-wrap rounded-lg bg-background text-foreground-muted">
            {decrypted}
          </pre>
        </div>
      )}
    </div>
  );
}

export function PollSubmitConfirmPopup({
  cancelLabel,
  confirmLabel,
  testId,
  cancelTestId,
  onCancel,
  onConfirm,
}: {
  cancelLabel: string;
  confirmLabel: string;
  testId: string;
  cancelTestId?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="flex gap-3 justify-end w-full">
      <Button
        data-testid={cancelTestId}
        buttonStyle={ButtonStyle.Outline}
        shape={ButtonShape.Square}
        className="min-w-[120px]"
        onClick={onCancel}
      >
        {cancelLabel}
      </Button>
      <Button
        data-testid={testId}
        buttonStyle={ButtonStyle.Primary}
        shape={ButtonShape.Square}
        className="min-w-[120px]"
        onClick={onConfirm}
      >
        {confirmLabel}
      </Button>
    </div>
  );
}
