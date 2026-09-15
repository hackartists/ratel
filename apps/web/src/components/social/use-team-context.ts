// app/ratel/src/common/contexts/team_context.rs (`TeamContext`,
// `use_team_context`) — the signed-in user's teams.
//
// Rust installs it once at the app root as a `Loader` keyed on `logged_in`.
// Here it is a shared react-query cache entry, so every consumer (topbar team
// switcher, sidebar fallback, create-team popup, team settings) reads and
// writes the same list; `addTeam` mirrors Rust `teams.push(..)` without a
// refetch, and `restartTeams` / `deleteTeam` invalidate every `getUserTeams`
// entry like `teams.restart()` / `teams.write().retain(..)`.
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { TeamItem } from "@ratel/ts-bridges";
import { deleteTeamHandler, getUserTeamsHandler } from "@ratel/ts-bridges";
import { useAuth } from "@/lib/auth";

/** Prefix of every team-list cache key (`["getUserTeams", loggedIn]`). */
export const USER_TEAMS_KEY = ["getUserTeams"] as const;

export interface TeamContext {
  teams: TeamItem[];
  addTeam(team: TeamItem): void;
  /** Rust `teams.restart()`. */
  refresh(): Promise<void>;
  /** Rust `teams.restart()`, fire and forget. */
  restartTeams(): void;
  /** Rust `TeamContext::delete_team` — delete, then drop the team from the cached list. */
  deleteTeam(username: string): Promise<void>;
}

const teamsKey = (loggedIn: boolean) => [...USER_TEAMS_KEY, loggedIn] as const;

export function useTeamContext(): TeamContext {
  const { loggedIn, ready } = useAuth();
  const queryClient = useQueryClient();
  const key = teamsKey(loggedIn);
  const query = useQuery({
    queryKey: key,
    // `get_user_teams_handler().await.unwrap_or_default().items`
    queryFn: async () => {
      if (!loggedIn) return [] as TeamItem[];
      try {
        return (await getUserTeamsHandler()).items;
      } catch {
        return [] as TeamItem[];
      }
    },
    enabled: ready,
    staleTime: Infinity,
  });

  const restartTeams = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: USER_TEAMS_KEY });
  }, [queryClient]);

  const deleteTeam = useCallback(
    async (username: string) => {
      await deleteTeamHandler(username);
      await queryClient.invalidateQueries({ queryKey: USER_TEAMS_KEY });
    },
    [queryClient],
  );

  return {
    teams: query.data ?? [],
    addTeam: (team) => queryClient.setQueryData<TeamItem[]>(key, (prev) => [...(prev ?? []), team]),
    refresh: async () => {
      await queryClient.invalidateQueries({ queryKey: USER_TEAMS_KEY });
    },
    restartTeams,
    deleteTeam,
  };
}
