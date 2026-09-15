import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getLobbyHandler, getMyStatsHandler, joinLobbyHandler } from "@ratel/ts-bridges";
import type { LobbyResponse, RoundResponse, UserStatsResponse } from "@ratel/ts-bridges";

// app/ratel/src/features/arcade/pages/home/hooks.rs (`UseArcadeHome`) — the
// lobby and my-stats loaders plus the join mutation. The Rust refresh counters
// map to query invalidation.
//
// Freshness: a Dioxus `use_loader` fetches when its page mounts, and this page
// redirects on `already_joined`, so it must never render another page's (or its
// own earlier visit's) lobby. Each arcade page therefore keeps its own lobby
// entry (`["getLobby", "<page>"]`), dropped as soon as the page unmounts
// (`gcTime: 0`; suspense queries keep it ≥1s), and join clears the matching
// page's entry it navigates to.

export const HOME_LOBBY_KEY = ["getLobby", "home"] as const;
const MATCHING_LOBBY_KEY = ["getLobby", "matching"] as const;
const MY_STATS_KEY = ["getMyStats", "home"] as const;

/** `ctx.lobby()?` */
export function useLobby(): LobbyResponse {
  return useSuspenseQuery({ queryKey: HOME_LOBBY_KEY, queryFn: () => getLobbyHandler(), gcTime: 0 }).data;
}

/** `ctx.my_stats()?` */
export function useMyStats(): UserStatsResponse {
  return useSuspenseQuery({ queryKey: MY_STATS_KEY, queryFn: () => getMyStatsHandler(), gcTime: 0 }).data;
}

/** `ctx.join()` — joins the lobby, then refetches it. */
export function useJoinRound(): () => Promise<RoundResponse> {
  const queryClient = useQueryClient();
  return async () => {
    const res = await joinLobbyHandler();
    queryClient.removeQueries({ queryKey: MATCHING_LOBBY_KEY, exact: true });
    void queryClient.invalidateQueries({ queryKey: HOME_LOBBY_KEY, exact: true });
    return res;
  };
}
