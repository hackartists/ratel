import { useState } from "react";
import { useTeamMemberActions, type TeamMemberResponse } from "@/components/team-member/use-team-members";
import { useTeamMemberI18n } from "@/i18n/generated/features/social/pages/member/views/team-member.i18n";
import { dataBool } from "@/lib/dom";
import { useToast } from "@/lib/toast";

// `MemberCard` (app/ratel/src/features/social/pages/member/views/mod.rs):
// avatar, name/handle, role badge and — for editors, on non-owner rows — the
// "…" menu that toggles Admin/Member or removes the member. The menu stays in
// the DOM; `aria-expanded` on its wrapper shows it (main.css).

export interface MemberCardProps {
  member: TeamMemberResponse;
  teamPk: string;
  canEdit: boolean;
  menuOpen: boolean;
  onToggleMenu: (userId: string) => void;
  onChanged: () => void;
}

const firstUpper = (value: string) => {
  const first = Array.from(value)[0];
  return first === undefined ? undefined : first.toUpperCase();
};

export function MemberCard({ member, teamPk, canEdit, menuOpen, onToggleMenu, onChanged }: MemberCardProps) {
  const tr = useTeamMemberI18n();
  const toast = useToast();
  const { updateRole, removeMember } = useTeamMemberActions();
  const [working, setWorking] = useState(false);

  const initial = firstUpper(member.display_name) ?? firstUpper(member.username) ?? "?";
  const handle = `@${member.username}`;

  const [badgeClass, badgeLabel] = member.is_owner
    ? ["tm-role-badge tm-role-badge--owner", tr.roleOwner]
    : member.role === "owner"
      ? ["tm-role-badge tm-role-badge--owner", tr.roleOwner]
      : member.role === "admin"
        ? ["tm-role-badge tm-role-badge--admin", tr.roleAdmin]
        : ["tm-role-badge tm-role-badge--member", tr.roleMember];

  const isAdminRole = member.role === "admin" && !member.is_owner;
  const toggleLabel = isAdminRole ? tr.actionMakeMember : tr.actionMakeAdmin;
  const nextRole = isAdminRole ? "member" : "admin";

  const onToggleRole = async () => {
    if (working) return;
    setWorking(true);
    try {
      await updateRole(teamPk, member.user_id, nextRole);
      toast.info(tr.roleUpdated);
      onChanged();
    } catch (error) {
      toast.error(error);
    }
    setWorking(false);
  };

  const onRemove = async () => {
    if (working) return;
    setWorking(true);
    try {
      await removeMember(teamPk, member.user_id);
      toast.info(tr.memberRemoved);
      onChanged();
    } catch (error) {
      toast.error(error);
    }
    setWorking(false);
  };

  return (
    <div className="tm-member-card" onClick={(e) => e.stopPropagation()}>
      {member.profile_url !== "" ? (
        <img className="tm-member-avatar" src={member.profile_url} alt={member.display_name} />
      ) : (
        <div className="tm-member-avatar">{initial}</div>
      )}
      <div className="tm-member-body">
        <span className="tm-member-name">{member.display_name}</span>
        <span className="tm-member-handle">{handle}</span>
      </div>
      <span className={badgeClass}>{badgeLabel}</span>
      {!member.is_owner && canEdit && (
        <div className="tm-member-action-wrap" aria-expanded={dataBool(menuOpen)}>
          <button
            className="tm-member-action"
            type="button"
            aria-label="More"
            onClick={(e) => {
              e.stopPropagation();
              onToggleMenu(member.user_id);
            }}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="19" cy="12" r="1.5" />
            </svg>
          </button>
          <div className="tm-member-menu" role="menu">
            <button className="tm-member-menu__item" type="button" disabled={working} onClick={() => void onToggleRole()}>
              {isAdminRole ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              )}
              {toggleLabel}
            </button>
            <div className="tm-member-menu__divider" />
            <button
              className="tm-member-menu__item tm-member-menu__item--danger"
              type="button"
              disabled={working}
              onClick={() => void onRemove()}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18" />
                <path d="M6 6l12 12" />
              </svg>
              {tr.actionRemove}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
