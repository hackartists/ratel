import { useSpaceAnalyzesAppI18n } from "@/pages/spaces/[spaceId]/apps/analyzes/space-analyzes-app.i18n";
import { joinClass } from "@/lib/dom";
import { usePopup } from "@/lib/popup";
import { useAnalyzeReportDetailContext } from "../hooks/use-analyze-report-detail";

/** Props for {@link ReanalyzeConfirmPopup}. */
export interface ReanalyzeConfirmPopupProps {
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirmation step shown before a re-analysis replaces the stored poll/quiz/follow results. */
export function ReanalyzeConfirmPopup({ onConfirm, onCancel }: ReanalyzeConfirmPopupProps) {
  const tr = useSpaceAnalyzesAppI18n();
  return (
    <div className="flex flex-col w-[480px] max-w-full gap-6 p-6" data-testid="reanalyze-confirm-popup">
      <div className="flex flex-col gap-2">
        <div className="text-lg font-bold text-text-primary text-center">{tr.reanalyzeConfirmTitle}</div>
        <div className="text-sm text-text-secondary leading-6 text-center">{tr.reanalyzeConfirmDesc}</div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          className="h-10 px-4 rounded-lg border border-neutral-300 text-text-primary transition-colors duration-150 hover:bg-neutral-100"
          data-testid="reanalyze-cancel-btn"
          onClick={() => onCancel()}
        >
          {tr.reanalyzeCancel}
        </button>
        <button
          type="button"
          className="h-10 px-4 rounded-lg bg-primary text-black font-semibold transition-opacity duration-150 hover:opacity-90"
          data-testid="reanalyze-confirm-btn"
          onClick={() => onConfirm()}
        >
          {tr.reanalyzeConfirmOk}
        </button>
      </div>
    </div>
  );
}

/** Props for {@link ReanalyzeButton}. */
export interface ReanalyzeButtonProps {
  /** Extra classes, e.g. `panel-toolbar__action` to push the button to the right edge of the toolbar. */
  className?: string;
}

/**
 * Report-level "re-analyze" toolbar button: confirms, then re-runs the
 * report against the current data. Disabled and labelled as running while
 * the request is in flight or the report is back in `in_progress`.
 */
export function ReanalyzeButton({ className }: ReanalyzeButtonProps) {
  const tr = useSpaceAnalyzesAppI18n();
  const ctrl = useAnalyzeReportDetailContext();
  const popup = usePopup();
  const running = ctrl.reanalyzing;

  const openConfirm = () =>
    popup.open(
      <ReanalyzeConfirmPopup
        onConfirm={() => {
          popup.close();
          ctrl.handleReanalyze();
        }}
        onCancel={() => popup.close()}
      />,
    );

  return (
    <button
      className={joinClass("btn btn--ghost", className)}
      type="button"
      data-testid="reanalyze-btn"
      data-running={running ? "true" : "false"}
      aria-busy={running}
      disabled={running}
      onClick={openConfirm}
    >
      <svg
        className="reanalyze-btn__icon"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="23 4 23 10 17 10" />
        <polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
      </svg>
      {running ? tr.reanalyzeRunning : tr.reanalyze}
    </button>
  );
}
