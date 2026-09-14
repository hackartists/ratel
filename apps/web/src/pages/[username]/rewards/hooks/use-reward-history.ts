import { useInfiniteQuery } from "@tanstack/react-query";
import { listRewardHistoryHandler } from "@ratel/ts-bridges";
import type { RewardHistoryItem } from "@ratel/ts-bridges";

// app/ratel/src/features/social/pages/reward/user/components/reward_history_section.rs
// state: `items`, `next_bookmark`, `is_fetching`, `has_loaded_once`.
//
// Not `use_infinite_query` in Rust — a hand-rolled list that fetches the first
// page once on mount (a failure is logged and shows the empty state) and
// appends pages from a "Load more" button (a failure is logged and keeps the
// bookmark, so the button stays for a retry). No de-duplication, no retries.

export interface UseRewardHistory {
  items: RewardHistoryItem[];
  /** `next_bookmark.is_some()`. */
  hasMore: boolean;
  /** `is_fetching` — a "Load more" page is in flight. */
  fetching: boolean;
  /** `has_loaded_once` — the first request finished (success or failure). */
  loaded: boolean;
  loadMore(): void;
}

export function useRewardHistory(username: string): UseRewardHistory {
  const query = useInfiniteQuery({
    queryKey: ["listRewardHistory", "section", username],
    queryFn: ({ pageParam }) => listRewardHistoryHandler(username, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.bookmark ?? undefined,
    retry: false,
    // Rust keeps the list in component signals: every mount starts empty and
    // fetches again.
    gcTime: 0,
    staleTime: 0,
  });

  if (query.isError) console.error("initial reward history fetch failed:", query.error);
  if (query.isFetchNextPageError) console.error("load_more reward history failed:", query.error);

  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const fetching = query.isFetchingNextPage;

  return {
    items,
    hasMore: query.hasNextPage,
    fetching,
    loaded: !query.isPending,
    loadMore: () => {
      if (fetching || !query.hasNextPage) return;
      void query.fetchNextPage();
    },
  };
}
