import type { LeaveParentRequest, ParentRelationshipResponse, TeamPartition } from "@ratel/ts-bridges";
import { useGetParentRelationship, useLeaveParent } from "@ratel/ts-bridges/hooks";

// app/ratel/src/features/sub_team/hooks/use_parent_relationship.rs
// (`UseParentRelationship`) — controller for `/:username/parent/leave`
// (and, eventually, the parent HUD panel). `:username` is the viewer's OWN
// team; the role check resolves against that team server-side.

const EMPTY: ParentRelationshipResponse = {
  status: "Standalone",
  parent_team_id: null,
  pending_parent_team_id: null,
  latest_application_id: null,
  parent_team_display_name: null,
  parent_team_username: null,
  recognized_at: null,
};

export interface UseParentRelationship {
  ready: boolean;
  relationship: ParentRelationshipResponse;
  /** Awaitable — the caller should `await` before navigating away. */
  leave: (req: LeaveParentRequest) => Promise<void>;
}

export function useParentRelationship(teamId: TeamPartition): UseParentRelationship {
  const relationshipQuery = useGetParentRelationship(teamId);
  const leaveMutation = useLeaveParent();

  return {
    ready: relationshipQuery.data !== undefined,
    relationship: relationshipQuery.data ?? EMPTY,
    leave: async (req) => {
      await leaveMutation.mutateAsync({ teamPk: teamId, body: req });
      await relationshipQuery.refetch();
    },
  };
}
