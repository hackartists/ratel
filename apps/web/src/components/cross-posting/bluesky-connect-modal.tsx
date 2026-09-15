import { useState } from "react";
import { useBlueskyConnectModalI18n } from "./bluesky-connect-modal.i18n";
import { dataBool } from "@/lib/dom";

// app/ratel/src/features/cross_posting/components/bluesky_connect_modal
// (`BlueskyConnectModal`) — shared by the onboarding interstitial and the
// Settings → Connections page. Always mounted; `data-open` drives the CSS
// reveal. Closing (backdrop, ×, Cancel) clears both fields; a submit hands
// `(handle, appPassword)` to the parent, which decides whether to close.

export interface BlueskyConnectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (handle: string, appPassword: string) => void;
}

export function BlueskyConnectModal({ open, onOpenChange, onSubmit }: BlueskyConnectModalProps) {
  const [handle, setHandle] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const t = useBlueskyConnectModalI18n();

  const close = () => {
    onOpenChange(false);
    setHandle("");
    setAppPassword("");
  };

  const submitDisabled = handle.trim() === "" || appPassword.trim() === "";

  return (
    <div className="bsky-modal-backdrop" data-open={dataBool(open)} onClick={close}>
      <div
        className="bsky-modal"
        role="dialog"
        aria-labelledby="bsky-modal-title"
        // Clicks inside the modal must not reach the backdrop.
        onClick={(e) => e.stopPropagation()}
      >
        <header className="bsky-modal__head">
          <span className="bsky-modal__logo">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 10.5c-1.3-2.5-4.9-7.2-8.2-9.5C.7-1.2 0 .5 0 1.5c0 1.1.6 9.1 1 10.3.8 4 5.5 5.1 9.6 4.4-6.5 1.1-12.3 3.5-4.7 11.4 2.5 2.6 3.5-2.6 4-5.2.5 2.6 1.6 7.8 4 5.2 7.7-7.9 1.9-10.4-4.6-11.5 4 .7 8.8-.4 9.6-4.4.4-1.2 1-9.2 1-10.3 0-1-.7-2.7-3.8-.5-3.3 2.3-6.9 7-8.2 9.6z" />
            </svg>
          </span>
          <div className="bsky-modal__head-body">
            <div id="bsky-modal-title" className="bsky-modal__head-title">
              {t.title}
            </div>
            <div className="bsky-modal__head-sub">{t.subtitle}</div>
          </div>
          <button className="bsky-modal__close" aria-label={t.close} onClick={close}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <div className="bsky-modal__body">
          <div className="bsky-modal__info">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <div>{t.info}</div>
          </div>

          <div className="bsky-field">
            <label className="bsky-field__label">{t.labelHandle}</label>
            <input
              className="bsky-field__input"
              type="text"
              placeholder={t.placeholderHandle}
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
            />
            <span className="bsky-field__hint">{t.hintHandle}</span>
          </div>

          <div className="bsky-field">
            <label className="bsky-field__label">{t.labelAppPassword}</label>
            <input
              className="bsky-field__input"
              type="password"
              placeholder={t.placeholderAppPassword}
              value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)}
            />
            <span className="bsky-field__hint">{t.hintAppPassword}</span>
          </div>
        </div>

        <footer className="bsky-modal__foot">
          <span className="bsky-modal__foot-hint">{t.footHint}</span>
          <div className="bsky-modal__actions">
            <button className="bsky-modal__btn bsky-modal__btn--cancel" onClick={close}>
              {t.btnCancel}
            </button>
            <button
              className="bsky-modal__btn bsky-modal__btn--primary"
              disabled={submitDisabled}
              onClick={() => {
                const h = handle.trim();
                const p = appPassword.trim();
                if (h !== "" && p !== "") onSubmit(h, p);
              }}
            >
              {t.btnConnect}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
