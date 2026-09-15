import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getLeaderboardHandler } from "@ratel/ts-bridges";
import type { LeaderboardEntryResponse } from "@ratel/ts-bridges";

// app/ratel/src/features/arcade/pages/home/hooks.rs — the `leaderboard`
// `use_infinite_query`. Same pagination rules as `useInfiniteList`, but the
// first page suspends (the Rust hook `?`-suspends on it) instead of rendering
// the empty-state placeholder while it loads.

const identity = (item: unknown) => JSON.stringify(item);

export interface Leaderboard {
  entries: LeaderboardEntryResponse[];
  hasMore: boolean;
  isLoading: boolean;
  next: () => void;
}

export function useLeaderboard(): Leaderboard {
  const query = useSuspenseInfiniteQuery({
    queryKey: ["getLeaderboard", "infinite"],
    queryFn: ({ pageParam }) => getLeaderboardHandler(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.bookmark === null) return undefined;
      if (allPages.length > 1) {
        const seen = new Set(allPages.slice(0, -1).flatMap((page) => page.items.map(identity)));
        if (lastPage.items.every((item) => seen.has(identity(item)))) return undefined;
      }
      return lastPage.bookmark;
    },
  });

  const entries = useMemo(() => {
    const seen = new Set<string>();
    const out: LeaderboardEntryResponse[] = [];
    for (const page of query.data.pages) {
      for (const item of page.items) {
        const id = identity(item);
        if (seen.has(id)) continue;
        seen.add(id);
        out.push(item);
      }
    }
    return out;
  }, [query.data]);

  const { fetchNextPage } = query;
  return {
    entries,
    hasMore: query.hasNextPage && !query.isFetchNextPageError,
    isLoading: query.isFetchingNextPage,
    next: () => void fetchNextPage(),
  };
}
