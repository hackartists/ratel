import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SubTeamDetailResponse, TeamPartition } from "@ratel/ts-bridges";
import { useDeregisterSubTeam, useGetSubTeamDetail } from "@ratel/ts-bridges/hooks";

// app/ratel/src/features/sub_team/hooks/use_sub_team_deregister.rs
// (`UseSubTeamDeregister`) — controller for
// `/:username/sub-teams/:subTeamId/deregister`. `:username` is the PARENT
// (admin) team; `:subTeamId` is the child being unlinked. On success, Rust
// pushes the parent's management page (the stale detail page is gone).

export interface UseSubTeamDeregister {
  ready: boolean;
  detail: SubTeamDetailResponse;
  reason: string;
  setReason: (value: string) => void;
  deregister: (reason: string) => void;
}

const EMPTY_DETAIL: SubTeamDetailResponse = {
  sub_team_id: "",
  display_name: "",
  profile_url: "",
  username: "",
  recognized_at: 0,
  window: "Monthly",
  post_count: 0,
  space_count: 0,
  active_member_count: 0,
  total_member_count: 0,
  privacy_notice: { en: "", ko: "" },
};

export function useSubTeamDeregister(
  teamId: TeamPartition,
  subTeamId: string,
  parentUsername: string,
): UseSubTeamDeregister {
  const navigate = useNavigate();
  const [reason, setReason] = useState("");

  const detailQuery = useGetSubTeamDetail(teamId, subTeamId, undefined);
  const deregisterMutation = useDeregisterSubTeam();

  const deregister = (reasonText: string) => {
    deregisterMutation.mutate(
      { teamPk: teamId, subTeamId, body: { reason: reasonText } },
      {
        onSuccess: () => {
          if (parentUsername !== "") {
            navigate(`/${parentUsername}/sub-teams/manage`);
          } else {
            navigate(-1);
          }
        },
      },
    );
  };

  return {
    ready: detailQuery.data !== undefined,
    detail: detailQuery.data ?? EMPTY_DETAIL,
    reason,
    setReason,
    deregister,
  };
}
