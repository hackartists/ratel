import { useSuspenseQuery } from "@tanstack/react-query";
import { getTeamRewardPermissionHandler, getTeamRewardsHandler } from "@ratel/ts-bridges";
import type { TeamPartition, TeamRewardPermission } from "@ratel/ts-bridges";
import { useUserContext } from "@/lib/auth";

// app/ratel/src/features/social/pages/reward/team/views/mod.rs `Home`. Both
// loaders swallow errors with `.ok()`, so neither reaches the error boundary.

/** `get_team_reward_permission_handler(username()).await.ok()`. */
export function useTeamRewardPermission(username: string): TeamRewardPermission | null {
  const viewer = useUserContext().user?.pk ?? null;
  return useSuspenseQuery({
    queryKey: ["getTeamRewardPermission", username, viewer],
    queryFn: () => getTeamRewardPermissionHandler(username).catch(() => null),
  }).data;
}

/**
 * `get_team_rewards_handler(team_pk, None).await.ok()` → `.unwrap_or_default().team_points`.
 * The endpoint requires a session, so a signed-out viewer sees 0.
 */
export function useTeamRewardPoints(teamPk: TeamPartition): number {
  const viewer = useUserContext().user?.pk ?? null;
  return useSuspenseQuery({
    queryKey: ["getTeamRewards", teamPk, null, viewer],
    queryFn: () => getTeamRewardsHandler(teamPk, null).catch(() => null),
  }).data?.team_points ?? 0;
}
