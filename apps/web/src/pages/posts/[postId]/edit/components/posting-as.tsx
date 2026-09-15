import { useRef } from "react";
import type { TeamItem } from "@ratel/ts-bridges";
import type { PostEditI18n } from "@/i18n/generated/features/posts/views/post_edit/post-edit.i18n";
import { dataBool } from "@/lib/dom";
import { useDismissOnOutsideClick } from "@/lib/use-dismiss-on-outside-click";

// app/ratel/src/features/posts/views/post_edit/posting_as.rs (`PostingAs`).

const DEFAULT_AVATAR = "https://metadata.ratel.foundation/ratel/default-profile.png";

export interface PostingAsProps {
  tr: PostEditI18n;
  userAvatar: string;
  userLabel: string;
  teams: TeamItem[];
  selectedTeamPk: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSwitch: (teamPk: string | null) => void;
}

export function PostingAs({ tr, userAvatar, userLabel, teams, selectedTeamPk, open, onOpenChange, onSwitch }: PostingAsProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  useDismissOnOutsideClick(rootRef, open, onOpenChange);

  const selectedTeam = selectedTeamPk ? teams.find((t) => t.pk === selectedTeamPk) : undefined;
  const triggerAvatar = selectedTeam ? (selectedTeam.profile_url === "" ? DEFAULT_AVATAR : selectedTeam.profile_url) : userAvatar;
  const triggerName = selectedTeam ? (selectedTeam.nickname === "" ? selectedTeam.username : selectedTeam.nickname) : userLabel;
  const triggerMeta = selectedTeam ? tr.teamMeta : tr.personalFeed;
  const triggerAvatarTeam = selectedTeam !== undefined;

  return (
    <div className="side-card">
      <div className="side-card__title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        {tr.postingAs}
      </div>
      <div className="as-dropdown" id="as-dropdown" data-open={dataBool(open)} ref={rootRef}>
        <button
          className="as-dropdown__trigger"
          id="as-dropdown-trigger"
          aria-haspopup="listbox"
          aria-expanded={dataBool(open)}
          onClick={() => onOpenChange(!open)}
        >
          <img className={triggerAvatarTeam ? "as-avatar as-avatar--team" : "as-avatar"} src={triggerAvatar} alt="" />
          <div className="as-text">
            <span className="as-text__name">{triggerName}</span>
            <span className="as-text__meta">{triggerMeta}</span>
          </div>
          <span className="as-dropdown__chevron">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </button>
        <div className="as-dropdown__menu" role="listbox">
          <div className="as-dropdown__group-label">{tr.groupPersonal}</div>
          <button className="as-dropdown__item" role="option" aria-selected={dataBool(selectedTeamPk === null)} onClick={() => onSwitch(null)}>
            <img className="as-avatar" src={userAvatar} alt="" />
            <div className="as-text">
              <span className="as-text__name">{userLabel}</span>
              <span className="as-text__meta">{tr.personalFeed}</span>
            </div>
            <span className="as-dropdown__check">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
          </button>
          {teams.length > 0 && (
            <>
              <div className="as-dropdown__group-label">{tr.groupTeams}</div>
              {teams.map((team) => {
                const isSelected = selectedTeamPk === team.pk;
                const teamAvatar = team.profile_url === "" ? DEFAULT_AVATAR : team.profile_url;
                const teamName = team.nickname === "" ? team.username : team.nickname;
                return (
                  <button
                    key={team.pk}
                    className="as-dropdown__item"
                    role="option"
                    aria-selected={dataBool(isSelected)}
                    onClick={() => onSwitch(team.pk)}
                  >
                    <img className="as-avatar as-avatar--team" src={teamAvatar} alt="" />
                    <div className="as-text">
                      <span className="as-text__name">{teamName}</span>
                      <span className="as-text__meta">{tr.teamMeta}</span>
                    </div>
                    <span className="as-dropdown__check">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                  </button>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
