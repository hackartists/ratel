import { useMemo, useState } from "react";
import {
  useTeamMemberList,
  type TeamMemberList,
  type TeamMemberResponse,
} from "@/components/team-member/use-team-members";

// State of app/ratel/src/features/social/pages/member/views/mod.rs `Home`
// once the permission has loaded: the paginated member list plus the role
// filter, name search, open row menu and invite-modal toggle.

/** `RoleFilter`. */
export type RoleFilter = "All" | "Owner" | "Admin" | "Member";

export interface UseTeamMemberPage {
  list: TeamMemberList;
  roleFilter: RoleFilter;
  setRoleFilter: (filter: RoleFilter) => void;
  search: string;
  setSearch: (value: string) => void;
  openMenuPk: string | null;
  closeMenu: () => void;
  /** `on_toggle_menu`: open this row's menu, or close it when it is already open. */
  toggleMenu: (userId: string) => void;
  inviteOpen: boolean;
  setInviteOpen: (open: boolean) => void;
  total: number;
  ownerCount: number;
  adminCount: number;
  memberCount: number;
  /** Members matching the role filter and the name search. */
  filtered: TeamMemberResponse[];
}

const isAdmin = (m: TeamMemberResponse) => !m.is_owner && m.role === "admin";
const isMember = (m: TeamMemberResponse) => !m.is_owner && m.role === "member";

export function useTeamMemberPage(teamPk: string): UseTeamMemberPage {
  // `list_members_handler(team_pk, bookmark, None)`.
  const list = useTeamMemberList(teamPk, { limit: null, emptyOnError: false });
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("All");
  const [search, setSearch] = useState("");
  const [openMenuPk, setOpenMenuPk] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const members = list.items;
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return members
      .filter((m) => {
        switch (roleFilter) {
          case "All":
            return true;
          case "Owner":
            return m.is_owner;
          case "Admin":
            return isAdmin(m);
          case "Member":
            return isMember(m);
        }
      })
      .filter((m) => q === "" || m.username.toLowerCase().includes(q) || m.display_name.toLowerCase().includes(q));
  }, [members, roleFilter, search]);

  return {
    list,
    roleFilter,
    setRoleFilter,
    search,
    setSearch,
    openMenuPk,
    closeMenu: () => setOpenMenuPk(null),
    toggleMenu: (userId) => setOpenMenuPk((cur) => (cur === userId ? null : userId)),
    inviteOpen,
    setInviteOpen,
    total: members.length,
    ownerCount: members.filter((m) => m.is_owner).length,
    adminCount: members.filter(isAdmin).length,
    memberCount: members.filter(isMember).length,
    filtered,
  };
}
