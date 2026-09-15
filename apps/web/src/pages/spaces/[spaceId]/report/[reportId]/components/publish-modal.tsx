import { useReportDetailI18n } from "@/pages/spaces/[spaceId]/report/[reportId]/i18n";
import { useReportDetailContext } from "../hooks/use-report-detail";

// app/ratel/src/features/spaces/pages/report/views/detail/publish_modal.rs
//
// Publish confirmation modal — arena glass styling matching the list page's
// DeleteConfirmModal (`.confirm-modal`), but with `--primary` action button
// styling instead of `--danger`. Rendered INLINE inside `.report-detail` so
// it inherits the page-scoped CSS rules; visibility is controlled by the
// report-detail hook's `publishModalOpen` so any sibling can flip it.

export function PublishConfirmModal() {
  const tr = useReportDetailI18n();
  const ctx = useReportDetailContext();

  if (!ctx.publishModalOpen) return null;

  const pending = ctx.publishPending;

  return (
    <div
      className="confirm-modal"
      role="dialog"
      aria-modal="true"
      onClick={() => {
        if (!pending) ctx.closePublishModal();
      }}
    >
      <div className="confirm-modal__panel" onClick={(e) => e.stopPropagation()}>
        <span className="confirm-modal__eyebrow">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          {tr.publishModalTitle}
        </span>
        <div className="confirm-modal__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" x2="8" y1="13" y2="13" />
            <line x1="16" x2="8" y1="17" y2="17" />
          </svg>
        </div>
        <div className="confirm-modal__title">{tr.publishModalTitle}</div>
        <div className="confirm-modal__body">{tr.publishModalBody}</div>
        <div className="confirm-modal__actions">
          <button className="confirm-modal__btn confirm-modal__btn--ghost" type="button" disabled={pending} onClick={() => ctx.closePublishModal()}>
            {tr.publishModalCancel}
          </button>
          <button
            className="confirm-modal__btn confirm-modal__btn--primary"
            data-testid="publish-confirm"
            type="button"
            disabled={pending}
            onClick={() => {
              if (!pending) {
                ctx.handlePublish();
                ctx.closePublishModal();
              }
            }}
          >
            {pending ? tr.publishingLabel : tr.publishModalConfirm}
          </button>
        </div>
      </div>
    </div>
  );
}
