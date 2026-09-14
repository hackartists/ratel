import { useSuspenseQuery, type QueryKey } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";

// app/ratel/src/common/hooks/use_infinite_query.rs (`use_infinite_query`) as
// the management page uses it: the first page is a suspending loader
// (`use_loader(..)?`), later pages are appended on demand by `next()`, and
// `refresh()` drops the paginated state and reloads the first page.
//
// `useInfiniteList` in ts-bridges is non-suspending; the Rust page suspends
// until the first page of every list resolves, so this local hook keeps that.

interface Page<T> {
  items: T[];
  bookmark: string | null;
}

interface Paged<T> {
  items: T[];
  next: string | null;
  bookmark: string | null;
}

export interface InfinitePages<T> {
  items: T[];
  hasMore: boolean;
  isLoading: boolean;
  next: () => void;
  refresh: () => void;
  /** `ctrl.key` — random per query, used in the sentinel id. */
  sentinelKey: string;
}

/** Items compare with `PartialEq` in Rust; structural JSON equality here. */
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function randomKey(): string {
  const buf = new BigUint64Array(1);
  crypto.getRandomValues(buf);
  return buf[0].toString();
}

export function useInfinitePages<T>(
  queryKey: QueryKey,
  fetchPage: (bookmark: string | null) => Promise<Page<T>>,
): InfinitePages<T> {
  const base = useSuspenseQuery({ queryKey, queryFn: () => fetchPage(null) });
  // `None` = not paginated: items follow the base page (`_sync_effect`).
  const [paged, setPaged] = useState<Paged<T> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sentinelKey] = useState(randomKey);

  const items = paged ? paged.items : base.data.items;
  const nextBookmark = paged ? paged.next : base.data.bookmark;

  const latest = useRef({ items, nextBookmark, bookmark: paged?.bookmark ?? null, isLoading, fetchPage });
  latest.current = { items, nextBookmark, bookmark: paged?.bookmark ?? null, isLoading, fetchPage };
  const generation = useRef(0);

  const next = useCallback(() => {
    const cur = latest.current;
    const nb = cur.nextBookmark;
    if (cur.isLoading || nb === null || cur.bookmark === nb) return;
    const gen = generation.current;
    const startItems = cur.items;
    latest.current = { ...cur, bookmark: nb, isLoading: true };
    setPaged({ items: startItems, next: nb, bookmark: nb });
    setIsLoading(true);
    void (async () => {
      let result: Paged<T>;
      try {
        const ret = await cur.fetchPage(nb);
        const merged = [...startItems];
        let appended = false;
        for (const item of ret.items) {
          if (merged.some((existing) => same(existing, item))) continue;
          merged.push(item);
          appended = true;
        }
        result = { items: merged, next: appended ? ret.bookmark : null, bookmark: nb };
      } catch (e) {
        // Stop pagination on error so the sentinel can't loop.
        console.debug("Effect fetch failed for bookmark:", nb, e);
        result = { items: startItems, next: null, bookmark: nb };
      }
      if (gen !== generation.current) return;
      setPaged(result);
      setIsLoading(false);
    })();
  }, []);

  const refetch = base.refetch;
  const refresh = useCallback(() => {
    generation.current += 1;
    setPaged(null);
    setIsLoading(false);
    void refetch();
  }, [refetch]);

  return { items, hasMore: nextBookmark !== null, isLoading, next, refresh, sentinelKey };
}
