import * as React from "react";
import { useUpdateSpace } from "@ratel/ts-bridges/hooks";
import type { SpacePartition } from "@ratel/ts-bridges";
import { useSpaceEndModalI18n } from "@/i18n/generated/features/spaces/space_common/components/space_end_modal/space-end-modal.i18n";
import { useSpaceStartModalI18n } from "@/i18n/generated/features/spaces/space_common/components/space_start_modal/space-start-modal.i18n";
import { usePopup } from "@/lib/popup";
import { useToast } from "@/lib/toast";

// app/ratel/src/features/spaces/space_common/components/{space_start_modal,space_end_modal}/mod.rs.
// Both post `update_space` (`Start { start: true }` / `Finish { finished: true }`),
// call `on_success` and close the popup on success, toast the error otherwise.

interface StatusModalProps {
  spaceId: SpacePartition;
  onSuccess: () => void;
  onClose?: () => void;
}

const CANCEL_CLASS =
  "px-10 py-[14.5px] min-w-[120px] text-base font-bold rounded-[10px] transition-colors bg-btn-outline-bg border border-btn-outline-outline text-btn-outline-text hover:bg-btn-outline-hover-bg hover:border-btn-outline-hover-outline hover:text-btn-outline-hover-text";
const CONFIRM_CLASS =
  "w-full py-[14.5px] font-bold text-base rounded-[10px] bg-primary text-black hover:bg-primary/80 transition-colors";
const CONFIRM_BUSY_CLASS =
  "w-full py-[14.5px] font-bold text-base rounded-[10px] bg-neutral-700 light:bg-neutral-300 text-neutral-500 cursor-not-allowed transition-colors";

function StatusModal({
  spaceId,
  onSuccess,
  onClose,
  kind,
}: StatusModalProps & { kind: "start" | "end" }) {
  const startTr = useSpaceStartModalI18n();
  const endTr = useSpaceEndModalI18n();
  const popup = usePopup();
  const toast = useToast();
  const updateSpace = useUpdateSpace();
  const [busy, setBusy] = React.useState(false);
  const busyRef = React.useRef(false);

  const warning = kind === "start" ? startTr.warning : endTr.warning;
  const cancel = kind === "start" ? startTr.cancel : endTr.cancel;
  const label = kind === "start" ? startTr.start : endTr.end;
  const busyLabel = kind === "start" ? startTr.starting : endTr.ending;

  const onConfirm = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await updateSpace.mutateAsync({
        spaceId,
        req: kind === "start" ? { start: true } : { finished: true },
      });
      onSuccess();
      popup.close();
    } catch (err) {
      toast.error(err);
    }
    busyRef.current = false;
    setBusy(false);
  };

  return (
    <div className="flex flex-col mt-6 w-[420px] max-w-full">
      <div className="mb-6 text-base font-medium text-center text-text-secondary">{warning}</div>
      <div className="flex flex-row gap-4 justify-end mt-4">
        <button
          onClick={() => {
            onClose?.();
            popup.close();
          }}
          className={CANCEL_CLASS}
        >
          {cancel}
        </button>
        <button
          data-testid={kind === "start" ? "start-space-button" : "end-space-button"}
          onClick={() => void onConfirm()}
          disabled={busy}
          className={busy ? CONFIRM_BUSY_CLASS : CONFIRM_CLASS}
        >
          {busy ? busyLabel : label}
        </button>
      </div>
    </div>
  );
}

/** Rust `SpaceStartModal`. */
export function SpaceStartModal(props: StatusModalProps) {
  return <StatusModal {...props} kind="start" />;
}

/** Rust `SpaceEndModal`. */
export function SpaceEndModal(props: StatusModalProps) {
  return <StatusModal {...props} kind="end" />;
}
