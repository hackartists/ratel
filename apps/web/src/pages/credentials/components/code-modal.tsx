import { useState } from "react";
import type { CredentialResponse } from "@ratel/ts-bridges";
import { useEnumI18n } from "@/i18n/enums.i18n";
import { useCredentialsI18n } from "@/pages/credentials/credentials.i18n";
import { usePopup } from "@/lib/popup";
import { useToast } from "@/lib/toast";

// `CodeModal` (credentials/views/mod.rs), opened in the app popup. The popup
// renders outside the page, so the controller's `submitCode` / `refresh` come
// in as props. Raw input/buttons and their palette classes are the Rust markup.

export interface CodeModalProps {
  onSubmit: (code: string) => Promise<CredentialResponse>;
  onSuccess: () => void;
}

export function CodeModal({ onSubmit, onSuccess }: CodeModalProps) {
  const tr = useCredentialsI18n();
  const te = useEnumI18n();
  const popup = usePopup();
  const toast = useToast();
  const [codeValue, setCodeValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (submitting) return;
    const code = codeValue.trim();
    if (code === "") {
      toast.error(new Error(te("Error", "InvalidCodeInput")));
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(code);
      popup.close();
      onSuccess();
    } catch (err) {
      toast.error(err);
    }
    setSubmitting(false);
  };

  return (
    <div className="p-6 w-full max-w-md">
      <h2 className="mb-4 text-xl font-bold text-modal-label-text">{tr.modalCodeTitle}</h2>
      <div className="mb-4">
        <input
          type="text"
          value={codeValue}
          onChange={(e) => setCodeValue(e.target.value)}
          placeholder={tr.modalCodePlaceholder}
          className="py-2 px-3 w-full rounded border border-gray-300 dark:bg-gray-700 dark:border-gray-600 text-neutral-500"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button className="hover:text-white text-neutral-500" onClick={() => popup.close()}>
          {tr.modalCancel}
        </button>
        <button
          className="py-2 px-4 rounded-md bg-enable-button-bg text-enable-button-white-text"
          disabled={submitting}
          onClick={() => void submit()}
        >
          {tr.modalSubmit}
        </button>
      </div>
    </div>
  );
}
