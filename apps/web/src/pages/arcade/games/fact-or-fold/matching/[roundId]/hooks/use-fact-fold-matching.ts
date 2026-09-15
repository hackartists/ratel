import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getLobbyHandler, leaveLobbyHandler } from "@ratel/ts-bridges";
import type { LobbyResponse, RoundResponse } from "@ratel/ts-bridges";

// app/ratel/src/features/arcade/games/fact_or_fold/pages/matching/hooks.rs
// (`UseFactFoldMatching`) — the lobby loader and the leave action. The page's
// 2s `use_future` refresh loop becomes the query's `refetchInterval`.
//
// Like the home page (pages/arcade/home/hooks/use-arcade-home.ts), this page
// keeps its own lobby entry so its redirect never acts on a lobby fetched
// before the join; leaving clears the home entry it navigates back to.

const MATCHING_LOBBY_KEY = ["getLobby", "matching"] as const;
const HOME_LOBBY_KEY = ["getLobby", "home"] as const;
const POLL_INTERVAL_MS = 2_000;

/** `ctx.lobby()?`, refreshed every 2s while the page is mounted. */
export function useMatchingLobby(): LobbyResponse {
  return useSuspenseQuery({
    queryKey: MATCHING_LOBBY_KEY,
    queryFn: () => getLobbyHandler(),
    gcTime: 0,
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: true,
  }).data;
}

/** `ctx.leave()` — leaves the lobby, then refetches it. */
export function useLeaveLobby(): () => Promise<RoundResponse> {
  const queryClient = useQueryClient();
  return async () => {
    const res = await leaveLobbyHandler();
    queryClient.removeQueries({ queryKey: HOME_LOBBY_KEY, exact: true });
    void queryClient.invalidateQueries({ queryKey: MATCHING_LOBBY_KEY, exact: true });
    return res;
  };
}
