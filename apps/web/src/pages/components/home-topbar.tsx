import { useRef, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { TeamItem } from "@ratel/ts-bridges";
import { useLoginModal, LOGIN_MODAL_TITLE } from "@/components/auth";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ArenaTeamCreationPopup } from "@/components/team-creation/arena-team-creation-popup";
import { useHomeArenaI18n } from "@/i18n/generated/views/index/home-arena.i18n";
import { dataBool } from "@/lib/dom";
import { usePopup } from "@/lib/popup";
import { useDismissOnOutsideClick } from "@/lib/use-dismiss-on-outside-click";
import { BRAND_LOGO, isArcadeVisibleEnv } from "./format";

// app/ratel/src/views/index/component.rs:237-481 — the home arena HUD topbar:
// notifications, Arcade, the Teams switcher, Sign In, Admin, Settings and the
// hamburger. The Teams dropdown is always rendered; `.hud-teams[aria-expanded]`
// shows it, and a press outside `.hud-teams` closes it.

/** Rust hardcodes these outside `translate!` (component.rs:243, 403, 421). */
const LOGO_ALT = "Ratel logo";
const ADMIN_LABEL = "Admin";

export interface HomeTopbarProps {
  hasUser: boolean;
  isAdmin: boolean;
  teams: TeamItem[];
  teamsOpen: boolean;
  setTeamsOpen: (open: boolean) => void;
  onToggleNotifications: () => void;
  onArcade: () => void;
  onSettings: () => void;
  onMenu: () => void;
}

export function HomeTopbar({
  hasUser,
  isAdmin,
  teams,
  teamsOpen,
  setTeamsOpen,
  onToggleNotifications,
  onArcade,
  onSettings,
  onMenu,
}: HomeTopbarProps) {
  const t = useHomeArenaI18n();
  const navigate = useNavigate();
  const popup = usePopup();
  const loginModal = useLoginModal();
  const teamsRoot = useRef<HTMLDivElement>(null);
  useDismissOnOutsideClick(teamsRoot, teamsOpen, setTeamsOpen);

  return (
    <div className="arena-topbar">
      <div className="arena-topbar__brand">
        <img className="arena-topbar__logo" src={BRAND_LOGO} alt={LOGO_ALT} />
        <span className="arena-topbar__title">{t.brandTitle}</span>
        <span className="arena-topbar__status">{t.liveStatus}</span>
      </div>
      <div className="arena-topbar__actions">
        {hasUser && <NotificationBell className="hud-btn" onClick={onToggleNotifications} />}
        {isArcadeVisibleEnv() && (
          <button className="hud-btn" aria-label={t.arcade} data-testid="home-btn-arcade" onClick={onArcade}>
            <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8" cy="8" r="1" />
              <circle cx="16" cy="8" r="1" />
              <circle cx="12" cy="12" r="1" />
              <circle cx="8" cy="16" r="1" />
              <circle cx="16" cy="16" r="1" />
            </svg>
            <span className="hud-btn__label">{t.arcade}</span>
          </button>
        )}
        {hasUser && (
          <div className="hud-teams" aria-expanded={dataBool(teamsOpen)} ref={teamsRoot}>
            <button
              className="hud-btn"
              aria-label={t.teams}
              data-testid="home-btn-teams"
              onClick={(e: MouseEvent) => {
                e.stopPropagation();
                setTeamsOpen(!teamsOpen);
              }}
            >
              <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span className="hud-btn__label">{t.teams}</span>
            </button>
            <div className="team-dd" role="menu" data-testid="home-teams-dd" onClick={(e) => e.stopPropagation()}>
              <div className="team-dd__header">{t.teamsHeader}</div>
              <div className="team-dd__list" id="home-teams-dd-list">
                {teams.length === 0 ? (
                  <div className="team-dd__empty">{t.teamsEmpty}</div>
                ) : (
                  teams.map((team) => (
                    <HomeTeamDdItem
                      key={team.username}
                      username={team.username}
                      displayName={team.nickname === "" ? team.username : team.nickname}
                      profileUrl={team.profile_url}
                      onPick={() => {
                        setTeamsOpen(false);
                        navigate(`/${team.username}`);
                      }}
                    />
                  ))
                )}
              </div>
              <div
                className="team-dd__footer"
                role="button"
                tabIndex={0}
                data-testid="home-btn-create-team"
                onClick={() => {
                  setTeamsOpen(false);
                  popup.open(<ArenaTeamCreationPopup />, { closable: false, backdropClosable: true });
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                {t.createTeam}
              </div>
            </div>
          </div>
        )}
        {!hasUser && (
          <button
            className="hud-btn hud-btn--signin"
            aria-label={t.signIn}
            data-testid="home-btn-signin"
            onClick={() => loginModal.open({ title: LOGIN_MODAL_TITLE })}
          >
            <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 25 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M15.5 16.5V19C15.5 20.1046 14.6046 21 13.5 21H6.5C5.39543 21 4.5 20.1046 4.5 19V5C4.5 3.89543 5.39543 3 6.5 3H13.5C14.6046 3 15.5 3.89543 15.5 5V8.0625M20.5 12L9.5 12M9.5 12L12 14.5M9.5 12L12 9.5" />
            </svg>
            <span className="hud-btn__label">{t.signIn}</span>
          </button>
        )}
        {isAdmin && (
          <button className="hud-btn" aria-label={ADMIN_LABEL} data-testid="home-btn-admin" onClick={() => navigate("/admin")}>
            <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span className="hud-btn__label">{ADMIN_LABEL}</span>
          </button>
        )}
        <button className="hud-btn" aria-label={t.settings} data-testid="home-btn-settings" onClick={onSettings}>
          <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span className="hud-btn__label">{t.settings}</span>
        </button>
        <button className="hud-btn hud-btn--primary" aria-label={t.openMenu} aria-haspopup="dialog" data-testid="home-btn-menu" onClick={onMenu}>
          <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
          <span className="hud-btn__label">{t.menu}</span>
        </button>
      </div>
    </div>
  );
}

// component.rs:1024-1066 (`HomeTeamDdItem`).
function HomeTeamDdItem({
  username,
  displayName,
  profileUrl,
  onPick,
}: {
  username: string;
  displayName: string;
  profileUrl: string;
  onPick: () => void;
}) {
  const first = Array.from(displayName)[0];
  const initial = first !== undefined ? first.toUpperCase() : "T";
  return (
    <div className="team-dd__item" role="button" tabIndex={0} data-testid={`home-team-dd-item-${username}`} onClick={onPick}>
      {profileUrl !== "" ? (
        <img className="team-dd__avatar" src={profileUrl} alt={displayName} />
      ) : (
        <div className="team-dd__avatar">{initial}</div>
      )}
      <div className="team-dd__body">
        <span className="team-dd__name">{displayName}</span>
        <span className="team-dd__handle">{`@${username}`}</span>
      </div>
    </div>
  );
}
