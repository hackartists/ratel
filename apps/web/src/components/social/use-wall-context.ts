import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { useParams } from "react-router-dom";
import { getWallByUsername } from "@ratel/ts-bridges";
import type { TeamRole, Wall } from "@ratel/ts-bridges";

// wall-context: TEMPORARY local stand-ins for the shared providers that
// `SocialLayout` installs in Dioxus:
//   - app/ratel/src/features/social/hooks/use_wall_context.rs (`UseWallContext`)
//   - app/ratel/src/features/social/pages/team_arena/team_arena_context.rs (`TeamArenaContext`)
// The layout port (apps/web/src/layouts/social-layout.tsx) is in progress in
// parallel. Until it lands these hooks fetch the wall themselves, under the
// scaffolded `useGetWallByUsername` query key so the cache is shared with the
// layout once it exists. Every call site is marked `// wall-context:` so it can
// be switched to the shared provider.

/** Route param of the `/:username` nest. */
export function useRouteUsername(): string {
  return useParams().username ?? "";
}

/** `use_wall_context()` — suspends until `get_wall_by_username` resolves (the layout's `?`). */
export function useWallContext(username: string) {
  const query = useSuspenseQuery({
    queryKey: ["getWallByUsername", username],
    queryFn: () => getWallByUsername(username),
  });
  const data: Wall = query.data;
  return {
    data,
    isUser: data.user_type === "User",
    isTeam: data.user_type === "Team",
  };
}

/** `TeamRole::is_admin_or_owner`. */
export function isAdminOrOwner(role: TeamRole | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

/** `TeamRole::is_owner`. */
export function isOwner(role: TeamRole | null | undefined): boolean {
  return role === "owner";
}

export interface TeamArena {
  username: string;
  displayName: string;
  profileUrl: string;
  canEdit: boolean;
  isAdmin: boolean;
  isMember: boolean;
  role: TeamRole | null;
  following: boolean;
  teamId: string;
  description: string;
  createdAt: number;
  isParentEligible: boolean;
  minSubTeamMembers: number;
  minSubTeamAgeDays: number;
  viewerPendingApplicantUsername: string | null;
  viewerHasEligibleApplicantTeam: boolean;
  /** `refresh_trigger` bump: refetch the team profile the arena layout shows. */
  refresh: () => void;
}

/**
 * `use_team_arena()` — `TeamArenaContext::from(UseWallContext)`. Rust panics
 * when the wall isn't a team; here that is an error for the error boundary.
 * `active_tab` is owned by the layout (not ported yet), so pages don't set it.
 */
export function useTeamArena(username: string): TeamArena {
  const queryClient = useQueryClient();
  const { data } = useWallContext(username);
  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["getWallByUsername", username] });
  }, [queryClient, username]);
  if (data.user_type !== "Team") throw new Error("Wall context is not a team");
  const role = data.role ?? null;
  const admin = isAdminOrOwner(role);
  return {
    username: data.username,
    displayName: data.display_name,
    profileUrl: data.profile_url,
    canEdit: admin,
    isAdmin: admin,
    isMember: role !== null,
    role,
    following: data.following,
    teamId: data.id,
    description: data.description,
    createdAt: data.created_at,
    isParentEligible: data.is_parent_eligible,
    minSubTeamMembers: data.min_sub_team_members,
    minSubTeamAgeDays: data.min_sub_team_age_days,
    viewerPendingApplicantUsername: data.viewer_pending_applicant_username,
    viewerHasEligibleApplicantTeam: data.viewer_has_eligible_applicant_team,
    refresh,
  };
}
