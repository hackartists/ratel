import { useSuspenseQuery } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  deleteEssenceHandler,
  getEssenceStatsHandler,
  listEssencesHandler,
  type EssenceListResponse,
  type EssenceResponse,
  type EssenceStatsResponse,
} from "./essence-api";

// app/ratel/src/features/essence/hooks/use_essence_sources.rs — shared state
// and mutations for the Essence Sources page. The page builds the controller
// once (`useEssenceSourcesProvider`) and provides it; every section reads it
// back with `useEssenceSources()`.
//
// Pagination is server-driven: `pageBookmarks[N]` is the cursor that STARTS
// page N (index 0 is always `null`), extended as pages are fetched forward.

/** Page size — mirrors the server default on `list_essences_handler`. */
export const PAGE_SIZE = 10;

/** `KindFilter` (types/filters.rs). */
export type KindFilter = "All" | "Notion" | "Post" | "Comment" | "Poll" | "Quiz";

/** `EssenceSort` (types/filters.rs). */
export type EssenceSort = "LastEditedDesc" | "WordCountDesc" | "TitleAsc";

export interface UseEssenceSources {
  stats: EssenceStatsResponse;
  /** Rows for the currently visible page. */
  items: EssenceResponse[];
  pageIndex: number;
  isLoading: boolean;
  /** The last fetched page returned a bookmark. */
  hasNext: boolean;
  selectedKind: KindFilter;
  sortOrder: EssenceSort;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedRows: ReadonlySet<string>;
  goToPage: (target: number) => void;
  setKind: (kind: KindFilter) => void;
  setSort: (sort: EssenceSort) => void;
  deleteEssence: (id: string) => void;
  bulkRemove: () => void;
}

const EssenceSourcesContext = createContext<UseEssenceSources | null>(null);
export const EssenceSourcesProvider = EssenceSourcesContext.Provider;

export function useEssenceSources(): UseEssenceSources {
  const ctx = useContext(EssenceSourcesContext);
  if (!ctx) throw new Error("useEssenceSources must be used under EssenceSourcesProvider");
  return ctx;
}

/** Canonical query-string value of a sort option (server `parse_sort`). */
function sortQueryValue(s: EssenceSort): string {
  switch (s) {
    case "LastEditedDesc":
      return "last_edited";
    case "WordCountDesc":
      return "word_count";
    case "TitleAsc":
      return "title";
  }
}

/** Canonical query-string value of a kind filter (server `parse_kind`). */
function kindQueryValue(k: KindFilter): string {
  return k.toLowerCase();
}

function fetchPage(sort: EssenceSort, bookmark: string | null, kind: KindFilter): Promise<EssenceListResponse> {
  return listEssencesHandler(sortQueryValue(sort), bookmark, kindQueryValue(kind), PAGE_SIZE);
}

/** Builds the controller. Suspends until the stats load; a stats failure reaches the error boundary. */
export function useEssenceSourcesProvider(): UseEssenceSources {
  const stats = useSuspenseQuery({ queryKey: ["essence", "stats"], queryFn: getEssenceStatsHandler });

  const [sortOrder, setSortOrder] = useState<EssenceSort>("LastEditedDesc");
  const [selectedKind, setSelectedKind] = useState<KindFilter>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRows, setSelectedRows] = useState<ReadonlySet<string>>(() => new Set());
  const [items, setItems] = useState<EssenceResponse[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasNext, setHasNext] = useState(false);

  // The async actions read the latest values the way the Rust actions read
  // signals mid-flight, so they live in refs next to the rendered state.
  const sortRef = useRef(sortOrder);
  const kindRef = useRef(selectedKind);
  const pageIndexRef = useRef(0);
  const bookmarksRef = useRef<(string | null)[]>([null]);
  const selectedRowsRef = useRef(selectedRows);
  selectedRowsRef.current = selectedRows;

  const storeNextBookmark = (idx: number, next: string | null) => {
    if (next === null) return;
    const bks = bookmarksRef.current;
    while (bks.length <= idx + 1) bks.push(null);
    bks[idx + 1] = next;
  };

  const applyPage = (idx: number, resp: EssenceListResponse) => {
    setItems(resp.items);
    setHasNext(resp.bookmark !== null);
    storeNextBookmark(idx, resp.bookmark);
  };

  // Initial fetch — page 0 on first mount.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      setIsLoading(true);
      try {
        const resp = await fetchPage(sortRef.current, null, kindRef.current);
        setIsLoading(false);
        applyPage(0, resp);
      } catch (e) {
        setIsLoading(false);
        console.error("essence initial list failed:", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Reset pagination and reload page 0 with the given (sort, kind). */
  const resetAndReload = async (sort: EssenceSort, kind: KindFilter) => {
    pageIndexRef.current = 0;
    setPageIndex(0);
    bookmarksRef.current = [null];
    setIsLoading(true);
    try {
      const resp = await fetchPage(sort, null, kind);
      setIsLoading(false);
      applyPage(0, resp);
    } catch (e) {
      setIsLoading(false);
      console.error("essence reload failed:", e);
      setItems([]);
      setHasNext(false);
    }
  };

  /** Re-fetch the current page without changing it (after a delete). */
  const reloadCurrentPage = async () => {
    const idx = pageIndexRef.current;
    const bm = bookmarksRef.current[idx] ?? null;
    setIsLoading(true);
    try {
      const resp = await fetchPage(sortRef.current, bm, kindRef.current);
      setIsLoading(false);
      applyPage(idx, resp);
    } catch (e) {
      setIsLoading(false);
      console.error("essence page reload failed:", e);
    }
  };

  const goToPage = (target: number) => {
    void (async () => {
      // Fill in missing cursors by walking forward from the furthest known one.
      let cursorIdx = Math.max(bookmarksRef.current.length - 1, 0);
      try {
        while (cursorIdx < target) {
          const bm = bookmarksRef.current[cursorIdx] ?? null;
          const resp = await fetchPage(sortRef.current, bm, kindRef.current);
          if (resp.bookmark === null) break;
          storeNextBookmark(cursorIdx, resp.bookmark);
          cursorIdx += 1;
        }
      } catch (e) {
        // Rust: `?` ends the action with the error (no UI binds to it).
        console.error("essence page walk failed:", e);
        return;
      }

      const clamped = Math.min(target, cursorIdx);
      const bm = bookmarksRef.current[clamped] ?? null;
      setIsLoading(true);
      try {
        const resp = await fetchPage(sortRef.current, bm, kindRef.current);
        setIsLoading(false);
        setItems(resp.items);
        pageIndexRef.current = clamped;
        setPageIndex(clamped);
        setHasNext(resp.bookmark !== null);
        storeNextBookmark(clamped, resp.bookmark);
      } catch (e) {
        setIsLoading(false);
        console.error("essence page fetch failed:", e);
      }
    })();
  };

  const setKind = (kind: KindFilter) => {
    if (kindRef.current === kind) return;
    kindRef.current = kind;
    setSelectedKind(kind);
    void resetAndReload(sortRef.current, kind);
  };

  const setSort = (sort: EssenceSort) => {
    if (sortRef.current === sort) return;
    sortRef.current = sort;
    setSortOrder(sort);
    void resetAndReload(sort, kindRef.current);
  };

  const refetchStats = stats.refetch;

  const deleteEssence = (id: string) => {
    void (async () => {
      try {
        await deleteEssenceHandler(id);
      } catch (e) {
        console.error("essence delete failed:", e);
        return;
      }
      void refetchStats();
      await reloadCurrentPage();
    })();
  };

  const bulkRemove = () => {
    void (async () => {
      for (const id of selectedRowsRef.current) {
        try {
          await deleteEssenceHandler(id);
        } catch (e) {
          console.error("bulk_remove: delete failed:", e);
        }
      }
      setSelectedRows(new Set());
      void refetchStats();
      await reloadCurrentPage();
    })();
  };

  return {
    stats: stats.data,
    items,
    pageIndex,
    isLoading,
    hasNext,
    selectedKind,
    sortOrder,
    searchQuery,
    setSearchQuery: useCallback((q: string) => setSearchQuery(q), []),
    selectedRows,
    goToPage,
    setKind,
    setSort,
    deleteEssence,
    bulkRemove,
  };
}
