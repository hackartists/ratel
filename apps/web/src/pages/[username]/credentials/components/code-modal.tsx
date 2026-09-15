import { useState } from "react";
import { useSignAttributes } from "@ratel/ts-bridges/hooks";
import type { CredentialsI18n } from "@/pages/credentials/credentials.i18n";
import { useEnumI18n } from "@/i18n/enums.i18n";
import { usePopup } from "@/lib/popup";
import { useToast } from "@/lib/toast";

// app/ratel/src/features/social/pages/credentials/views/mod.rs (`CodeModal`).
export function CodeModal({ tr, onSuccess }: { tr: CredentialsI18n; onSuccess: () => void }) {
  const popup = usePopup();
  const toast = useToast();
  const enumText = useEnumI18n();
  const [code, setCode] = useState("");
  const signAttributes = useSignAttributes();

  const submit = () => {
    if (signAttributes.isPending) return;
    const trimmed = code.trim();
    if (trimmed === "") {
      toast.error(new Error(enumText("Error", "InvalidCodeInput")));
      return;
    }
    signAttributes.mutate(
      { type: "code", code: trimmed },
      {
        onSuccess: () => {
          popup.close();
          onSuccess();
        },
        onError: (e) => toast.error(e),
      },
    );
  };

  return (
    <div className="p-6 w-full max-w-md">
      <h2 className="mb-4 text-xl font-bold text-modal-label-text">{tr.modalCodeTitle}</h2>
      <div className="mb-4">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
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
          disabled={signAttributes.isPending}
          onClick={submit}
        >
          {tr.modalSubmit}
        </button>
      </div>
    </div>
  );
}
