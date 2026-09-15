import { useDeleteSpacePopupI18n } from "./i18n";

// general/views/home/delete_space_popup.rs — the arena confirmation modal,
// rendered inline inside `.space-general-arena` (not through the popup
// service) so it picks up the arena CSS tokens. Backdrop click cancels.
export function DeleteSpacePopup({
  spaceTitle,
  pending,
  onConfirm,
  onCancel,
}: {
  spaceTitle: string;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const tr = useDeleteSpacePopupI18n();

  return (
    <div className="sga-modal-overlay" onClick={onCancel}>
      <div className="sga-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sga-modal__header">
          <span className="sga-modal__title">{tr.title}</span>
          <button
            className="sga-modal__close"
            type="button"
            aria-label="Close"
            data-testid="delete-space-close"
            onClick={onCancel}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="sga-modal__body">
          <p className="sga-modal__desc">
            {tr.confirmPre}
            <strong>{spaceTitle}</strong>
            {tr.confirmPost}
          </p>
          <div className="sga-modal__actions">
            <button type="button" className="sga-modal__cancel" data-testid="delete-space-cancel" onClick={onCancel}>
              {tr.cancel}
            </button>
            <button
              type="button"
              className="sga-modal__confirm-danger"
              data-testid="delete-space-confirm"
              disabled={pending}
              onClick={onConfirm}
            >
              {tr.confirm}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
