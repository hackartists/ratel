import { Suspense, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { TeamArenaTab } from "@/components/social/team-arena-context";
import { useTeamContext } from "@/components/social/use-team-context";
import { ParentHudPanel } from "@/components/sub-team/parent-hud-panel";
import { useTeamArenaI18n } from "./i18n";
import { useUserContext } from "@/lib/auth";
import { usePopup } from "@/lib/popup";
import { useDismissOnOutsideClick } from "@/lib/use-dismiss-on-outside-click";
import { ArenaTeamCreationPopup } from "./arena-team-creation-popup";

// app/ratel/src/features/social/pages/team_arena/topbar/component.rs
// (`ArenaTopbar`, `TeamDdItem`, `HudButton`): back / team home, the team
// switcher dropdown, the HUD tab links and the Follow button.

export interface ArenaTopbarProps {
  username: string;
  displayName: string;
  profileUrl: string;
  active: TeamArenaTab;
  canEdit?: boolean;
  isMember?: boolean;
  isParentEligible?: boolean;
  pendingApplicantUsername?: string | null;
  viewerHasEligibleApplicantTeam?: boolean;
  isFollowing?: boolean;
  showFollow?: boolean;
  onFollow?: () => void;
  onOpenSettings?: () => void;
}

/** First char upper-cased, or "T" (Rust `initial`). */
function initialOf(name: string): string {
  const first = Array.from(name)[0];
  return first === undefined ? "T" : first.toUpperCase();
}

export function ArenaTopbar({
  username,
  displayName,
  profileUrl,
  active,
  canEdit = false,
  isMember = false,
  isParentEligible = false,
  pendingApplicantUsername = null,
  viewerHasEligibleApplicantTeam = false,
  isFollowing = false,
  showFollow = true,
  onFollow,
  onOpenSettings,
}: ArenaTopbarProps) {
  const tr = useTeamArenaI18n();
  const navigate = useNavigate();
  const popup = usePopup();
  const hasUser = useUserContext().user !== null;
  const { teams } = useTeamContext();

  const [ddOpen, setDdOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);
  useDismissOnOutsideClick(switcherRef, ddOpen, setDdOpen);

  const initial = initialOf(displayName);
  const handle = `@${username}`;

  const ddEntries = teams.map((t) => ({
    username: t.username,
    displayName: t.nickname === "" ? t.username : t.nickname,
    profileUrl: t.profile_url,
  }));
  if (!ddEntries.some((e) => e.username === username)) {
    ddEntries.unshift({ username, displayName, profileUrl });
  }

  const subTeamRoute = canEdit
    ? `/${username}/sub-teams/manage`
    : pendingApplicantUsername !== null
      ? `/${username}/sub-teams/application`
      : isParentEligible && hasUser && viewerHasEligibleApplicantTeam
        ? `/${username}/sub-teams/apply`
        : null;

  return (
    <div className="arena-topbar">
      <div className="arena-topbar__brand">
        <button className="arena-topbar__back" aria-label={tr.back} type="button" onClick={() => navigate("/")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <button className="arena-topbar__back" aria-label={tr.home} type="button" onClick={() => navigate(`/${username}`)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-6h-2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          </svg>
        </button>
        <span className="arena-topbar__divider" />

        <div
          ref={switcherRef}
          className="arena-topbar__switcher"
          role="button"
          tabIndex={0}
          aria-expanded={ddOpen ? "true" : "false"}
          onClick={(e) => {
            e.stopPropagation();
            setDdOpen(!ddOpen);
          }}
        >
          {profileUrl !== "" ? (
            <img className="arena-topbar__logo" src={profileUrl} alt={displayName} />
          ) : (
            <div className="arena-topbar__logo">{initial}</div>
          )}
          <div className="arena-topbar__switcher-body">
            <span className="arena-topbar__title">{displayName}</span>
            <span className="arena-topbar__handle">{handle}</span>
          </div>
          <svg className="arena-topbar__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>

          <div className="team-dd" role="menu" onClick={(e) => e.stopPropagation()}>
            {/* Rust hardcodes "Switch Team" / "Create Team" (topbar/component.rs:220,266). */}
            <div className="team-dd__header">Switch Team</div>
            <div className="team-dd__list" id="arena-teams-dd-list">
              {ddEntries.map((entry, idx) => (
                <TeamDdItem
                  key={entry.username}
                  username={entry.username}
                  displayName={entry.displayName}
                  profileUrl={entry.profileUrl}
                  isCurrent={entry.username === username}
                  colorVariant={idx % 3}
                  onPick={() => setDdOpen(false)}
                />
              ))}
            </div>
            <div
              className="team-dd__footer"
              role="button"
              tabIndex={0}
              onClick={() => {
                setDdOpen(false);
                popup.open(<ArenaTeamCreationPopup />, { closable: false, backdropClosable: true });
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Create Team
            </div>
          </div>
        </div>

        <span className="arena-topbar__status">{tr.statusActive}</span>
      </div>

      <div className="arena-topbar__actions">
        {canEdit && (
          <>
            <HudButton
              label={tr.drafts}
              active={active === TeamArenaTab.Drafts}
              to={`/${username}/drafts`}
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              }
            />
            <span className="arena-topbar__divider" style={{ margin: "0 2px" }} />
          </>
        )}

        <HudButton
          label={tr.members}
          active={active === TeamArenaTab.Members}
          to={`/${username}/members`}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          }
        />

        <HudButton
          label={tr.rewards}
          active={active === TeamArenaTab.Rewards}
          to={`/${username}/rewards`}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="7" />
              <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
            </svg>
          }
        />

        {canEdit && (
          <HudButton
            label={tr.subscription}
            active={active === TeamArenaTab.Subscription}
            to={`/${username}/settings/subscription`}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
            }
          />
        )}

        {isMember && (
          <Suspense fallback={null}>
            <ParentHudPanel />
          </Suspense>
        )}

        {subTeamRoute !== null && (
          <HudButton
            label={tr.subTeams}
            active={active === TeamArenaTab.SubTeams}
            to={subTeamRoute}
            className="arena-topbar__hud--mobile-hide"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l2.09 4.23 4.66.68-3.38 3.29.8 4.64L12 12.67l-4.17 2.17.8-4.64L5.25 6.91l4.66-.68L12 2z" />
                <circle cx="6" cy="19" r="3" />
                <circle cx="18" cy="19" r="3" />
                <path d="M9 19h6" />
              </svg>
            }
          />
        )}

        <button className="arena-topbar__hud" type="button" aria-label={tr.settings} onClick={() => onOpenSettings?.()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span className="arena-topbar__hud-label">{tr.settings}</span>
        </button>

        {showFollow && (
          <button className="arena-topbar__follow" type="button" onClick={() => onFollow?.()}>
            {isFollowing ? tr.unfollow : tr.follow}
          </button>
        )}
      </div>
    </div>
  );
}

function TeamDdItem({
  username,
  displayName,
  profileUrl,
  isCurrent,
  colorVariant,
  onPick,
}: {
  username: string;
  displayName: string;
  profileUrl: string;
  isCurrent: boolean;
  colorVariant: number;
  onPick: () => void;
}) {
  const navigate = useNavigate();
  const initial = initialOf(displayName);
  const handle = `@${username}`;
  const avatarClass =
    colorVariant === 1
      ? "team-dd__avatar team-dd__avatar--alt1"
      : colorVariant === 2
        ? "team-dd__avatar team-dd__avatar--alt2"
        : "team-dd__avatar";

  return (
    <div
      className="team-dd__item"
      role="button"
      tabIndex={0}
      onClick={() => {
        onPick();
        if (!isCurrent) navigate(`/${username}`);
      }}
    >
      {profileUrl !== "" ? (
        <img className={avatarClass} src={profileUrl} alt={displayName} />
      ) : (
        <div className={avatarClass}>{initial}</div>
      )}
      <div className="team-dd__body">
        <span className="team-dd__name">{displayName}</span>
        <span className="team-dd__handle">{handle}</span>
      </div>
      {isCurrent && (
        <svg className="team-dd__check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </div>
  );
}

function HudButton({
  label,
  active,
  to,
  icon,
  className = "",
}: {
  label: string;
  active: boolean;
  to: string;
  icon: ReactNode;
  className?: string;
}) {
  const activeClass = active ? "arena-topbar__hud--active" : "";
  return (
    // Dioxus's `Link` sets `aria-current="page"` automatically for the
    // active route; react-router-dom's plain `Link` (unlike `NavLink`) does
    // not, so it's set explicitly here to match.
    <Link to={to} className={`arena-topbar__hud ${activeClass} ${className}`} aria-label={label} aria-current={active ? "page" : undefined}>
      {icon}
      <span className="arena-topbar__hud-label">{label}</span>
    </Link>
  );
}
