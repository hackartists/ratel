// HAND-WRITTEN. Bookmark-paginated list hook — the React counterpart of the
// Dioxus `use_infinite_query` (app/ratel/src/common/hooks/use_infinite_query.rs).
//
// Same pagination rules as the Rust hook:
//   - the first page is fetched with no bookmark;
//   - the next page uses the `bookmark` the previous page returned, and there
//     is no next page when it is `null`;
//   - items equal to ones already loaded are dropped, and a page that adds
//     nothing new ends pagination (guards against a server repeating a page);
//   - a failed page ends pagination instead of retrying (`hasMore` is false),
//     so an always-visible "load more" sentinel can't loop.
import {
  useInfiniteQuery,
  useQueryClient,
  useSuspenseInfiniteQuery,
  type InfiniteData,
  type QueryKey,
  type UseInfiniteQueryOptions,
} from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import type { ApiError } from "../runtime/client";

/** Shape of the Rust `ListResponse<T>`. */
export interface BookmarkPage<T> {
  items: T[];
  bookmark: string | null;
}

type Bookmark = string | undefined;

export type UseInfiniteListOptions<T, K extends QueryKey> = Omit<
  UseInfiniteQueryOptions<BookmarkPage<T>, ApiError, InfiniteData<BookmarkPage<T>, Bookmark>, K, Bookmark>,
  "queryKey" | "queryFn" | "initialPageParam" | "getNextPageParam"
>;

const identity = (item: unknown) => JSON.stringify(item);

export function useInfiniteList<T, K extends QueryKey = QueryKey>(
  queryKey: K,
  fetchPage: (bookmark: Bookmark) => Promise<BookmarkPage<T>>,
  options?: UseInfiniteListOptions<T, K>,
) {
  const query = useInfiniteQuery<BookmarkPage<T>, ApiError, InfiniteData<BookmarkPage<T>, Bookmark>, K, Bookmark>({
    queryKey,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: undefined,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.bookmark === null) return undefined;
      if (allPages.length > 1) {
        const seen = new Set(allPages.slice(0, -1).flatMap((page) => page.items.map(identity)));
        if (lastPage.items.every((item) => seen.has(identity(item)))) return undefined;
      }
      return lastPage.bookmark;
    },
    ...options,
  });

  const items = useMemo(() => {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const page of query.data?.pages ?? []) {
      for (const item of page.items) {
        const id = identity(item);
        if (seen.has(id)) continue;
        seen.add(id);
        out.push(item);
      }
    }
    return out;
  }, [query.data]);

  return {
    ...query,
    /** All loaded items, de-duplicated, in page order. */
    items,
    /** Whether `fetchNextPage()` can load more (false after a failed page). */
    hasMore: query.hasNextPage && !query.isFetchNextPageError,
  };
}

/** `getNextPageParam` with the Rust pagination rules (see the header). */
function nextBookmark<T>(lastPage: BookmarkPage<T>, allPages: BookmarkPage<T>[]): Bookmark {
  if (lastPage.bookmark === null) return undefined;
  if (allPages.length > 1) {
    const seen = new Set(allPages.slice(0, -1).flatMap((page) => page.items.map(identity)));
    if (lastPage.items.every((item) => seen.has(identity(item)))) return undefined;
  }
  return lastPage.bookmark;
}

function dedupe<T>(pages: BookmarkPage<T>[] | undefined): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const page of pages ?? []) {
    for (const item of page.items) {
      const id = identity(item);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(item);
    }
  }
  return out;
}

/**
 * Query options shared by `useSuspenseInfiniteList`, for prefetching the first
 * page (`usePrefetchInfiniteQuery`) alongside other loaders.
 */
export function infiniteListOptions<T, K extends QueryKey = QueryKey>(
  queryKey: K,
  fetchPage: (bookmark: Bookmark) => Promise<BookmarkPage<T>>,
) {
  return {
    queryKey,
    queryFn: ({ pageParam }: { pageParam: Bookmark }) => fetchPage(pageParam),
    initialPageParam: undefined as Bookmark,
    getNextPageParam: nextBookmark<T>,
  };
}

/**
 * `useInfiniteList` that suspends until the first page resolves, like the Rust
 * hook (its base page is a `use_loader`). A failed first page reaches the error
 * boundary.
 *
 *   - `refresh()` — Rust `InfiniteQuery::refresh`: back to the first page,
 *     keeping the loaded items on screen until it answers.
 */
export function useSuspenseInfiniteList<T, K extends QueryKey = QueryKey>(
  queryKey: K,
  fetchPage: (bookmark: Bookmark) => Promise<BookmarkPage<T>>,
) {
  const queryClient = useQueryClient();
  const query = useSuspenseInfiniteQuery<BookmarkPage<T>, ApiError, InfiniteData<BookmarkPage<T>, Bookmark>, K, Bookmark>(
    infiniteListOptions<T, K>(queryKey, fetchPage),
  );

  const items = useMemo(() => dedupe(query.data.pages), [query.data]);

  const keyHash = JSON.stringify(queryKey);
  const refresh = useCallback(() => {
    const key = JSON.parse(keyHash) as QueryKey;
    queryClient.setQueryData<InfiniteData<BookmarkPage<T>, Bookmark>>(key, (data) =>
      data ? { pages: data.pages.slice(0, 1), pageParams: data.pageParams.slice(0, 1) } : data,
    );
    return queryClient.invalidateQueries({ queryKey: key, exact: true });
  }, [queryClient, keyHash]);

  return {
    ...query,
    /** All loaded items, de-duplicated, in page order. */
    items,
    /** Whether `fetchNextPage()` can load more (false after a failed page). */
    hasMore: query.hasNextPage && !query.isFetchNextPageError,
    refresh,
  };
}
