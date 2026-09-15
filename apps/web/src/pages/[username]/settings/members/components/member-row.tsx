import { useState } from "react";
import { Ellipsis, ShieldCheck, User, UserMinus } from "@/components/icons/lucide";
import { Button, ButtonShape, ButtonSize, ButtonStyle } from "@/components/ui/button";
import type { TeamMemberResponse, TeamRole } from "@/components/team-member/use-team-members";
import { useTeamSettingsI18n } from "@/pages/[username]/settings/i18n";

// `MemberRow` (app/ratel/src/features/social/pages/setting/team/views/management_page.rs):
// avatar, name, role label and — for managers, on non-owner rows — a "…"
// menu with Make admin / Make member / Remove from team. The last row opens
// its menu upward.

export interface MemberRowProps {
  member: TeamMemberResponse;
  isLast: boolean;
  canManage: boolean;
  isSelf: boolean;
  onRemove: () => void;
  onChangeRole: (userId: string, role: TeamRole) => void;
}

export function MemberRow({ member, isLast, canManage, isSelf, onRemove, onChangeRole }: MemberRowProps) {
  const tr = useTeamSettingsI18n();
  const [showMenu, setShowMenu] = useState(false);
  const borderClass = isLast ? "" : "border-b border-border";
  const canChangeRole = canManage && !member.is_owner && !isSelf;
  const display = member.display_name === "" ? member.username : member.display_name;
  const initial = (Array.from(display)[0] ?? "?").toUpperCase();

  return (
    <div className={`flex flex-col ${borderClass}`}>
      <div className="flex relative gap-3 items-center py-3 px-4">
        {member.profile_url !== "" ? (
          <img src={member.profile_url} alt={display} className="object-cover w-9 h-9 rounded-full shrink-0" />
        ) : (
          <div className="flex justify-center items-center w-9 h-9 rounded-full bg-profile-bg shrink-0">
            <span className="text-xs font-semibold text-text-primary">{initial}</span>
          </div>
        )}

        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-sm font-semibold text-text-primary truncate">{display}</span>
          <span className="text-xs text-foreground-muted truncate">{`@${member.username}`}</span>
        </div>

        {member.is_owner ? (
          <span className="text-sm text-foreground-muted shrink-0">{tr.owner}</span>
        ) : (
          <span className="text-sm text-foreground-muted shrink-0">{member.role === "admin" ? tr.adminRole : tr.memberRole}</span>
        )}

        {canManage && !member.is_owner ? (
          <div className="relative shrink-0">
            <Button
              buttonStyle={ButtonStyle.Text}
              size={ButtonSize.Icon}
              shape={ButtonShape.Square}
              className="flex justify-center items-center w-7 h-7"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu((v) => !v);
              }}
            >
              <Ellipsis className="w-4 h-4 [&>circle]:fill-text-primary [&>circle]:stroke-none" />
            </Button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div
                  className={
                    isLast
                      ? "absolute right-0 bottom-8 z-20 w-44 bg-popover border border-border rounded-lg shadow-lg py-1 overflow-hidden"
                      : "absolute right-0 top-8 z-20 w-44 bg-popover border border-border rounded-lg shadow-lg py-1 overflow-hidden"
                  }
                  onClick={(e) => e.stopPropagation()}
                >
                  {canChangeRole && member.role !== "admin" && (
                    <Button
                      buttonStyle={ButtonStyle.Text}
                      size={ButtonSize.Small}
                      shape={ButtonShape.Square}
                      className="flex gap-2 justify-start items-center w-full text-text-primary"
                      onClick={() => {
                        setShowMenu(false);
                        onChangeRole(member.user_id, "admin");
                      }}
                    >
                      <ShieldCheck className="w-4 h-4 [&>path]:stroke-text-primary" />
                      {tr.makeAdmin}
                    </Button>
                  )}
                  {canChangeRole && member.role !== "member" && (
                    <Button
                      buttonStyle={ButtonStyle.Text}
                      size={ButtonSize.Small}
                      shape={ButtonShape.Square}
                      className="flex gap-2 justify-start items-center w-full text-text-primary"
                      onClick={() => {
                        setShowMenu(false);
                        onChangeRole(member.user_id, "member");
                      }}
                    >
                      <User className="w-4 h-4 [&>path]:stroke-text-primary [&>circle]:stroke-text-primary" />
                      {tr.makeMember}
                    </Button>
                  )}
                  <Button
                    buttonStyle={ButtonStyle.Text}
                    size={ButtonSize.Small}
                    shape={ButtonShape.Square}
                    className="flex gap-2 justify-start items-center w-full text-destructive"
                    onClick={() => {
                      setShowMenu(false);
                      onRemove();
                    }}
                  >
                    <UserMinus className="w-4 h-4 [&>path]:stroke-destructive [&>line]:stroke-destructive" />
                    {tr.removeFromTeam}
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="w-7 shrink-0" />
        )}
      </div>
    </div>
  );
}
