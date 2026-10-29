import * as React from "react";
import { joinClass } from "@/lib/dom";

/** Visual weight of the confirm button: `primary` for reversible actions, `danger` for destructive ones. */
export type ConfirmPopupTone = "primary" | "danger";

/** Props for {@link ConfirmPopup}. */
export interface ConfirmPopupProps {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  tone?: ConfirmPopupTone;
  /**
   * Runs when the user confirms. When it returns a promise the popup keeps
   * both buttons disabled (and marks the confirm button `aria-busy`) until it
   * settles, so a slow request can't be fired twice.
   */
  onConfirm: () => void | Promise<unknown>;
  onCancel: () => void;
  /** `data-testid` of the popup root; the buttons get `<testId>-confirm` / `<testId>-cancel`. */
  testId?: string;
}

const CONFIRM_TONE_CLASS: Record<ConfirmPopupTone, string> = {
  primary: "bg-primary text-black",
  danger: "bg-red-600 text-white",
};

/**
 * Body for `usePopup().open(...)`: a centred title + description and a
 * Cancel / Confirm button pair. Shared confirmation step for actions that
 * change or destroy data.
 */
export function ConfirmPopup({
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = "primary",
  onConfirm,
  onCancel,
  testId = "confirm-popup",
}: ConfirmPopupProps) {
  const [pending, setPending] = React.useState(false);
  const mounted = React.useRef(true);
  React.useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const handleConfirm = () => {
    if (pending) return;
    const result = onConfirm();
    if (!(result instanceof Promise)) return;
    setPending(true);
    void result.finally(() => {
      if (mounted.current) setPending(false);
    });
  };

  return (
    <div className="flex flex-col w-[480px] max-w-full gap-6 p-6" data-testid={testId}>
      <div className="flex flex-col gap-2">
        <div className="text-lg font-bold text-text-primary text-center">{title}</div>
        <div className="text-sm text-text-secondary leading-6 text-center">{description}</div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          className="h-10 px-4 rounded-lg border border-neutral-300 text-text-primary transition-colors duration-150 hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid={`${testId}-cancel`}
          disabled={pending}
          onClick={() => onCancel()}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          className={joinClass(
            "h-10 px-4 rounded-lg font-semibold transition-opacity duration-150 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed",
            CONFIRM_TONE_CLASS[tone],
          )}
          data-testid={`${testId}-confirm`}
          data-tone={tone}
          aria-busy={pending}
          disabled={pending}
          onClick={handleConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
