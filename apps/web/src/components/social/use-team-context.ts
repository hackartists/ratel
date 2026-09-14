import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { deleteTeamHandler } from "@ratel/ts-bridges";

// app/ratel/src/common/contexts/team_context.rs (`TeamContext`) — the
// signed-in user's team list ("YOUR TEAMS"). RootLayout doesn't provide a
// React TeamContext yet, so the list lives in the react-query cache under the
// scaffolded `useGetUserTeams` key and mutations invalidate it, which is what
// `teams.restart()` / `teams.write().retain(..)` achieve in Rust.

export const USER_TEAMS_KEY = ["getUserTeams"] as const;

export function useTeamContext() {
  const queryClient = useQueryClient();

  /** `teams.restart()`. */
  const restartTeams = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: USER_TEAMS_KEY });
  }, [queryClient]);

  /** `TeamContext::delete_team` — delete, then drop the team from the cached list. */
  const deleteTeam = useCallback(
    async (username: string) => {
      await deleteTeamHandler(username);
      void queryClient.invalidateQueries({ queryKey: USER_TEAMS_KEY });
    },
    [queryClient],
  );

  return { restartTeams, deleteTeam };
}
