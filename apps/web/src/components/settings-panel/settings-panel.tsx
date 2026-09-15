import { useSignOut } from "@/components/auth";
import { AccountDeletionConfirm } from "@/components/profile-dropdown/account-deletion-confirm";
import { setLanguage } from "@/i18n";
import { useSpaceViewerI18n } from "@/pages/spaces/[spaceId]/components/space-viewer.i18n";
import { useUserContext } from "@/lib/auth";
import { dataBool } from "@/lib/dom";
import { useLanguage } from "@/lib/language";
import { usePopup } from "@/lib/popup";
import { Theme, useTheme } from "@/lib/theme";

// app/ratel/src/features/spaces/pages/index/settings_panel/component.rs
// (`SettingsPanel`) — the slide-in panel shared by the home arena and the space
// arena: theme, language, and (signed in) log out / delete account.
//
// The space arena also passes `is_admin` / `space_id` to render its Apps and
// Reports sections (apps_section/, reports_section/); the home arena passes
// neither, so those props arrive with the space page port.

/** Rust hardcodes this label (component.rs:30). */
const CLOSE_SETTINGS_LABEL = "Close settings";

export interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const tr = useSpaceViewerI18n();
  const theme = useTheme();
  const lang = useLanguage();
  const isLoggedIn = useUserContext().user !== null;
  const popup = usePopup();
  const signOut = useSignOut();

  return (
    <div className="settings-panel" data-testid="settings-panel" data-open={dataBool(open)}>
      <div className="settings-panel__header">
        <span className="settings-panel__title">{tr.settings}</span>
        <button aria-label={CLOSE_SETTINGS_LABEL} className="settings-panel__close" onClick={() => onClose()}>
          <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <line x1="18" x2="6" y1="6" y2="18" />
            <line x1="6" x2="18" y1="6" y2="18" />
          </svg>
        </button>
      </div>
      <div className="settings-panel__body">
        <div className="settings-group">
          <span className="settings-group__label">{tr.theme}</span>
          <div className="settings-options">
            <div
              className="settings-opt"
              data-testid="theme-dark"
              aria-selected={dataBool(theme.current === Theme.Dark)}
              onClick={() => theme.set(Theme.Dark)}
            >
              <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
              </svg>
              {tr.dark}
            </div>
            <div
              className="settings-opt"
              data-testid="theme-light"
              aria-selected={dataBool(theme.current === Theme.Light)}
              onClick={() => theme.set(Theme.Light)}
            >
              <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2" />
                <path d="M12 20v2" />
                <path d="m4.93 4.93 1.41 1.41" />
                <path d="m17.66 17.66 1.41 1.41" />
                <path d="M2 12h2" />
                <path d="M20 12h2" />
                <path d="m6.34 17.66-1.41 1.41" />
                <path d="m19.07 4.93-1.41 1.41" />
              </svg>
              {tr.light}
            </div>
            <div
              className="settings-opt"
              data-testid="theme-system"
              aria-selected={dataBool(theme.current === Theme.System)}
              onClick={() => theme.set(Theme.System)}
            >
              <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <rect height="14" rx="2" width="20" x="2" y="3" />
                <line x1="8" x2="16" y1="21" y2="21" />
                <line x1="12" x2="12" y1="17" y2="21" />
              </svg>
              {tr.system}
            </div>
          </div>
        </div>
        <div className="settings-group">
          <span className="settings-group__label">{tr.language}</span>
          <div className="settings-options">
            <div className="settings-opt" data-testid="lang-en" aria-selected={dataBool(lang === "en")} onClick={() => setLanguage("en")}>
              <span className="settings-opt__icon">EN</span>
              {tr.english}
            </div>
            <div className="settings-opt" data-testid="lang-ko" aria-selected={dataBool(lang === "ko")} onClick={() => setLanguage("ko")}>
              <span className="settings-opt__icon">KO</span>
              {tr.korean}
            </div>
          </div>
        </div>

        {isLoggedIn && (
          <div className="settings-logout">
            <button className="settings-logout__btn" data-testid="btn-logout" onClick={() => void signOut()}>
              <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" x2="9" y1="12" y2="12" />
              </svg>
              {tr.logout}
            </button>
            <button
              className="settings-logout__btn"
              data-testid="btn-delete-account"
              onClick={() => {
                onClose();
                popup.open(<AccountDeletionConfirm />);
              }}
            >
              <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
                <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
              </svg>
              {tr.deleteAccount}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
