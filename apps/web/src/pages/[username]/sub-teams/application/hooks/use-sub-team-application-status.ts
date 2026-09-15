import type { SubTeamApplicationResponse, TeamPartition } from "@ratel/ts-bridges";
import { useFindMyApplicationForParent } from "@ratel/ts-bridges/hooks";

// app/ratel/src/features/sub_team/hooks/use_sub_team_application_status.rs
// (`UseSubTeamApplicationStatus`) — controller for `/:username/sub-teams/application`.
// `:username` is the PARENT team; the viewer's admin/owner teams are walked
// server-side to find the one application targeting this parent.

export interface UseSubTeamApplicationStatus {
  ready: boolean;
  application: SubTeamApplicationResponse | null;
}

export function useSubTeamApplicationStatus(parentTeamId: TeamPartition): UseSubTeamApplicationStatus {
  const query = useFindMyApplicationForParent(parentTeamId);
  return {
    ready: query.data !== undefined,
    application: query.data ?? null,
  };
}
