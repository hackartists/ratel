import { useQueryClient, useSuspenseInfiniteQuery, type InfiniteData } from "@tanstack/react-query";
import type { ListResponse, PostResponse } from "@ratel/ts-bridges";

// `use_infinite_query(...)?` (common/hooks/use_infinite_query.rs) for the
// drafts lists: suspends until the first page loads (a failure reaches the
// error boundary, like the Rust `use_loader`), then pages by bookmark with the
// Rust hook's rules — items already loaded are dropped, a page that adds
// nothing ends pagination, a failed page ends it too.

type Bookmark = string | undefined;
type Page = ListResponse<PostResponse>;

const identity = (item: unknown) => JSON.stringify(item);

export interface DraftsList {
  items: PostResponse[];
  hasMore: boolean;
  loading: boolean;
  next(): void;
  /**
   * `InfiniteQuery::refresh()`: reload from the first page, keeping the loaded
   * items on screen until the new page arrives.
   */
  refresh(): Promise<void>;
}

export function useDraftsList(
  queryKey: readonly unknown[],
  fetchPage: (bookmark: string | null) => Promise<Page>,
): DraftsList {
  const queryClient = useQueryClient();
  const query = useSuspenseInfiniteQuery<Page, Error, InfiniteData<Page, Bookmark>, readonly unknown[], Bookmark>({
    queryKey,
    queryFn: ({ pageParam }) => fetchPage(pageParam ?? null),
    initialPageParam: undefined,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.bookmark === null) return undefined;
      if (allPages.length > 1) {
        const seen = new Set(allPages.slice(0, -1).flatMap((page) => page.items.map(identity)));
        if (lastPage.items.every((item) => seen.has(identity(item)))) return undefined;
      }
      return lastPage.bookmark;
    },
  });

  const seen = new Set<string>();
  const items: PostResponse[] = [];
  for (const page of query.data.pages) {
    for (const item of page.items) {
      const id = identity(item);
      if (seen.has(id)) continue;
      seen.add(id);
      items.push(item);
    }
  }

  return {
    items,
    hasMore: query.hasNextPage && !query.isFetchNextPageError,
    loading: query.isFetchingNextPage,
    next: () => {
      if (!query.isFetchingNextPage) void query.fetchNextPage();
    },
    refresh: async () => {
      // Drop the extra pages so only the first page is re-fetched, then refetch
      // in the background (the cached first page keeps rendering meanwhile).
      queryClient.setQueryData<InfiniteData<Page, Bookmark>>(queryKey, (data) =>
        data ? { pages: data.pages.slice(0, 1), pageParams: data.pageParams.slice(0, 1) } : data,
      );
      await query.refetch();
    },
  };
}

/** `Partition` / `FeedPartition` wire value → the id Rust `FeedPartition` renders (prefix stripped). */
export function partitionId(value: string): string {
  const hash = value.indexOf("#");
  return hash === -1 ? value : value.slice(hash + 1);
}
