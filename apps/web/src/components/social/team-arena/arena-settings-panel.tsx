import { useNavigate } from "react-router-dom";
import { LoginModal, SignupModal } from "@/components/auth";
import { useSignOut } from "@/components/auth/use-sign-out";
import { AccountDeletionConfirm } from "@/components/profile-dropdown/account-deletion-confirm";
import { setLanguage } from "@/i18n";
import { useTeamArenaI18n } from "./i18n";
import { useUserContext } from "@/lib/auth";
import { useLanguage } from "@/lib/language";
import { usePopup } from "@/lib/popup";
import { Theme, useTheme } from "@/lib/theme";

// app/ratel/src/features/social/pages/team_arena/settings_panel/component.rs
// (`ArenaSettingsPanel`): theme, language and the account actions.

export interface ArenaSettingsPanelProps {
  open: boolean;
  onClose: () => void;
  username: string;
  canEdit?: boolean;
}

export function ArenaSettingsPanel({ open, onClose, username, canEdit = false }: ArenaSettingsPanelProps) {
  const tr = useTeamArenaI18n();
  const theme = useTheme();
  const lang = useLanguage();
  const isLoggedIn = useUserContext().user !== null;
  const popup = usePopup();
  const navigate = useNavigate();
  const signOut = useSignOut();

  return (
    <>
      <div className="ta-settings-panel__backdrop" data-open={open ? "true" : "false"} onClick={() => onClose()} />
      <div className="ta-settings-panel" data-testid="team-settings-panel" data-open={open ? "true" : "false"}>
        <div className="ta-settings-panel__header">
          <span className="ta-settings-panel__title">{tr.settings}</span>
          {/* Rust hardcodes this label (settings_panel/component.rs:612). */}
          <button className="ta-settings-panel__close" aria-label="Close settings" type="button" onClick={() => onClose()}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="ta-settings-panel__body">
          <div className="ta-settings-group">
            <span className="ta-settings-group__label">{tr.theme}</span>
            <div className="ta-settings-options">
              <div
                className="ta-settings-opt"
                role="button"
                tabIndex={0}
                aria-selected={theme.current === Theme.Dark ? "true" : "false"}
                onClick={() => theme.set(Theme.Dark)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                </svg>
                {tr.dark}
              </div>
              <div
                className="ta-settings-opt"
                role="button"
                tabIndex={0}
                aria-selected={theme.current === Theme.Light ? "true" : "false"}
                onClick={() => theme.set(Theme.Light)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
                {tr.lightMode}
              </div>
              <div
                className="ta-settings-opt"
                role="button"
                tabIndex={0}
                aria-selected={theme.current === Theme.System ? "true" : "false"}
                onClick={() => theme.set(Theme.System)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
                {tr.system}
              </div>
            </div>
          </div>

          <div className="ta-settings-group">
            <span className="ta-settings-group__label">{tr.language}</span>
            <div className="ta-settings-options">
              <div
                className="ta-settings-opt"
                role="button"
                tabIndex={0}
                aria-selected={lang === "en" ? "true" : "false"}
                onClick={() => setLanguage("en")}
              >
                <span className="ta-settings-opt__icon">EN</span>
                {tr.english}
              </div>
              <div
                className="ta-settings-opt"
                role="button"
                tabIndex={0}
                aria-selected={lang === "ko" ? "true" : "false"}
                onClick={() => setLanguage("ko")}
              >
                <span className="ta-settings-opt__icon">KO</span>
                {tr.korean}
              </div>
            </div>
          </div>

          <div className="ta-settings-footer">
            {canEdit && (
              <a className="ta-settings-action" href={`/${username}/settings`} onClick={(e) => { e.preventDefault(); onClose(); navigate(`/${username}/settings`); }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                {tr.teamSettingsLink}
              </a>
            )}

            {isLoggedIn ? (
              <>
                <button
                  className="ta-settings-action ta-settings-action--logout"
                  type="button"
                  onClick={async () => {
                    await signOut();
                    navigate(`/${username}`, { replace: true });
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  {tr.logout}
                </button>
                <button
                  className="ta-settings-action ta-settings-action--logout"
                  type="button"
                  onClick={() => {
                    onClose();
                    popup.open(<AccountDeletionConfirm />);
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                    <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                  </svg>
                  {tr.deleteAccount}
                </button>
              </>
            ) : (
              <>
                <button
                  className="ta-settings-action ta-settings-action--login"
                  type="button"
                  onClick={() => {
                    onClose();
                    popup.open(<LoginModal />);
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <polyline points="10 17 15 12 10 7" />
                    <line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                  {tr.login}
                </button>
                <button
                  className="ta-settings-action"
                  type="button"
                  onClick={() => {
                    onClose();
                    popup.open(<SignupModal />);
                  }}
                >
                  {tr.signUp}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
