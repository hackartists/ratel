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
    // The popup box shrinks to its content (min 300px) and already pads by
    // 25px, so the modal sets its own width instead of `w-full` and adds no
    // padding of its own.
    <div className="w-[360px] max-mobile:w-full">
      <h2 className="mb-4 text-xl font-bold text-text-primary">{tr.modalCodeTitle}</h2>
      <div className="mb-4">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={tr.modalCodePlaceholder}
          className="py-2 px-3 w-full rounded-md border outline-none bg-input-box-bg border-input-box-border text-text-primary placeholder:text-foreground-muted focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button
          className="py-2 px-4 rounded-md transition-colors text-foreground-muted hover:text-text-primary hover:bg-hover"
          onClick={() => popup.close()}
        >
          {tr.modalCancel}
        </button>
        <button
          className="py-2 px-4 rounded-md transition-opacity bg-btn-primary-bg text-btn-primary-text hover:opacity-90 disabled:opacity-50"
          disabled={signAttributes.isPending}
          onClick={submit}
        >
          {tr.modalSubmit}
        </button>
      </div>
    </div>
  );
}
