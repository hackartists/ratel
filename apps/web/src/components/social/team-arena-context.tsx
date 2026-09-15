// app/ratel/src/features/social/pages/team_arena/team_arena_context.rs
// (`TeamArenaContext`, `use_team_arena`) — provided by `TeamArenaLayout` to
// every team page under `SocialLayout`.
//
// Pages mark their HUD tab with `useTeamArenaTab(TeamArenaTab.Drafts)`
// (Rust `use_effect(move || arena.active_tab.set(TeamArenaTab::Drafts))`).
// Like Rust, the tab is never reset: a page that doesn't set it keeps the
// previous one.
import * as React from "react";
import type { TeamPartition, TeamRole } from "@ratel/ts-bridges";
import { useWallContext, type TeamWall } from "./wall-context";

export const TeamArenaTab = {
  Home: "Home",
  Drafts: "Drafts",
  Members: "Members",
  Rewards: "Rewards",
  Subscription: "Subscription",
  SubTeams: "SubTeams",
  Settings: "Settings",
} as const;
export type TeamArenaTab = (typeof TeamArenaTab)[keyof typeof TeamArenaTab];

/** Owner/admin check of the Rust `TeamRole::is_admin_or_owner`. */
export function isAdminOrOwner(role: TeamRole | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

/** Rust `TeamRole::is_owner`. */
export function isOwner(role: TeamRole | null | undefined): boolean {
  return role === "owner";
}

export interface TeamArenaContextValue {
  activeTab: TeamArenaTab;
  setActiveTab(tab: TeamArenaTab): void;
  username: string;
  displayName: string;
  profileUrl: string;
  /** `role.is_admin_or_owner()`. */
  canEdit: boolean;
  /** Same as `canEdit` (Rust keeps both). */
  isAdmin: boolean;
  /** Any role. */
  isMember: boolean;
  role: TeamRole | null;
  following: boolean;
  setFollowing(following: boolean): void;
  teamId: TeamPartition;
  description: string;
  createdAt: number;
  isParentEligible: boolean;
  minSubTeamMembers: number;
  minSubTeamAgeDays: number;
  viewerPendingApplicantUsername: string | null;
  viewerHasEligibleApplicantTeam: boolean;
  /**
   * Rust `refresh_trigger` bump (the settings page after Save Changes):
   * re-fetches the wall so the topbar shows the new name / logo.
   */
  refresh(): Promise<void>;
}

const TeamArenaContext = React.createContext<TeamArenaContextValue | null>(null);

/** Rust `impl From<UseWallContext> for TeamArenaContext` + `provide_context`. */
export function TeamArenaProvider({ children }: { children: React.ReactNode }) {
  const wallCtx = useWallContext();
  if (wallCtx.wall.user_type !== "Team") {
    // Rust: `panic!("Wall context is not a team")`.
    throw new Error("Wall context is not a team");
  }
  const wall: TeamWall = wallCtx.wall;
  const [activeTab, setActiveTab] = React.useState<TeamArenaTab>(TeamArenaTab.Home);
  const { update, refresh } = wallCtx;

  const value = React.useMemo<TeamArenaContextValue>(() => {
    const member = wall.role !== null;
    const admin = isAdminOrOwner(wall.role);
    return {
      activeTab,
      setActiveTab,
      username: wall.username,
      displayName: wall.display_name,
      profileUrl: wall.profile_url,
      canEdit: admin,
      isAdmin: admin,
      isMember: member,
      role: wall.role,
      following: wall.following,
      setFollowing: (following) => update((w) => ({ ...w, following })),
      teamId: wall.id,
      description: wall.description,
      createdAt: wall.created_at,
      isParentEligible: wall.is_parent_eligible,
      minSubTeamMembers: wall.min_sub_team_members,
      minSubTeamAgeDays: wall.min_sub_team_age_days,
      viewerPendingApplicantUsername: wall.viewer_pending_applicant_username,
      viewerHasEligibleApplicantTeam: wall.viewer_has_eligible_applicant_team,
      refresh,
    };
  }, [wall, activeTab, update, refresh]);

  return <TeamArenaContext.Provider value={value}>{children}</TeamArenaContext.Provider>;
}

/** Rust `use_team_arena()`. Only valid under a team wall. */
export function useTeamArena(): TeamArenaContextValue {
  const ctx = React.useContext(TeamArenaContext);
  if (!ctx) throw new Error("useTeamArena must be used under TeamArenaLayout");
  return ctx;
}

/** Rust `use_context::<TeamPartition>()` inside the team arena. */
export function useTeamId(): TeamPartition {
  return useTeamArena().teamId;
}

/** Rust `use_effect(move || arena.active_tab.set(tab))`. */
export function useTeamArenaTab(tab: TeamArenaTab): void {
  const { setActiveTab } = useTeamArena();
  React.useEffect(() => {
    setActiveTab(tab);
  }, [setActiveTab, tab]);
}
