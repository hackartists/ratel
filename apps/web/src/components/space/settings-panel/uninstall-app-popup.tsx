import * as React from "react";
import { useAppsSectionI18n } from "./apps-section.i18n";

const CANCEL_CLASS =
  "px-10 py-[14.5px] min-w-[120px] text-base font-bold rounded-[10px] transition-colors bg-btn-outline-bg border border-btn-outline-outline text-btn-outline-text hover:bg-btn-outline-hover-bg hover:border-btn-outline-hover-outline hover:text-btn-outline-hover-text disabled:opacity-50 disabled:cursor-not-allowed";
const CONFIRM_CLASS =
  "w-full py-[14.5px] font-bold text-base rounded-[10px] bg-red-600 text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed";

export interface UninstallAppPopupProps {
  appName: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

/**
 * Confirmation body for removing a space app, opened through the app-wide popup service.
 *
 * `onConfirm` runs the uninstall; both buttons stay disabled until it settles.
 */
export function UninstallAppPopup({ appName, onConfirm, onCancel }: UninstallAppPopupProps) {
  const tr = useAppsSectionI18n();
  const [busy, setBusy] = React.useState(false);
  const busyRef = React.useRef(false);

  const confirm = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col w-[420px] max-w-full gap-6" data-testid="uninstall-app-popup">
      <div className="flex flex-col gap-2 text-center">
        <div className="text-lg font-bold text-text-primary">{tr.uninstallConfirmTitle}</div>
        <div className="text-base font-semibold text-text-primary">{appName}</div>
        <div className="text-sm leading-6 text-text-secondary">{tr.uninstallConfirmDescription}</div>
      </div>
      <div className="flex flex-row gap-4 justify-end">
        <button
          type="button"
          className={CANCEL_CLASS}
          data-testid="uninstall-app-cancel"
          disabled={busy}
          onClick={() => onCancel()}
        >
          {tr.uninstallCancel}
        </button>
        <button
          type="button"
          className={CONFIRM_CLASS}
          data-testid="uninstall-app-confirm"
          disabled={busy}
          onClick={() => void confirm()}
        >
          {busy ? tr.uninstalling : tr.uninstallConfirm}
        </button>
      </div>
    </div>
  );
}
