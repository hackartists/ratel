import { useState } from "react";
import {
  isAdminOrOwner,
  useTeamMemberActions,
  useTeamMemberList,
  useTeamMemberPermission,
  type TeamMemberList,
  type TeamRole,
} from "@/components/team-member/use-team-members";
import { useTeamSettingsI18n } from "@/i18n/generated/features/social/pages/setting/team/views/team-settings.i18n";
import { useUserContext } from "@/lib/auth";

// State of app/ratel/src/features/social/pages/setting/team/views/management_page.rs
// (`ManagementPage`): permission (suspends; failures reach the error
// boundary), the 10-per-page member list (failed pages read as empty), the
// signed-in user's pk, and the remove / change-role mutations that set or
// clear the page error and refresh the list.

const PAGE_SIZE = 10;

export interface UseManagementPage {
  teamPk: string;
  canManage: boolean;
  currentUserPk: string | null;
  list: TeamMemberList;
  errorMsg: string | null;
  removeMember: (userId: string) => Promise<void>;
  changeRole: (userId: string, role: TeamRole) => Promise<void>;
}

export function useManagementPage(username: string): UseManagementPage {
  const tr = useTeamSettingsI18n();
  const permission = useTeamMemberPermission(username);
  const teamPk = permission.team_pk;
  const list = useTeamMemberList(teamPk, { limit: PAGE_SIZE, emptyOnError: true });
  const { removeMember, updateRole } = useTeamMemberActions();
  const currentUserPk = useUserContext().user?.pk ?? null;
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  return {
    teamPk,
    canManage: isAdminOrOwner(permission.role),
    currentUserPk,
    list,
    errorMsg,
    removeMember: async (userId) => {
      try {
        await removeMember(teamPk, userId);
      } catch {
        setErrorMsg(tr.failedRemoveMember);
        return;
      }
      setErrorMsg(null);
      list.refresh();
    },
    changeRole: async (userId, role) => {
      try {
        await updateRole(teamPk, userId, role);
      } catch {
        setErrorMsg(tr.failedChangeRole);
        return;
      }
      setErrorMsg(null);
      list.refresh();
    },
  };
}
