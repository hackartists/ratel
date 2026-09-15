import { useEffect, useRef } from "react";
import type { InfinitePages } from "../hooks/use-infinite-pages";

// `InfiniteQuery::more_element()` (common/hooks/use_infinite_query.rs): a
// "Loading more..." row while a page is in flight, otherwise a 1px sentinel
// that loads the next page once it scrolls into view (threshold 0.1, the
// observer disconnects after the first hit), and nothing when there is no
// next page.
export function MoreElement({ query }: { query: InfinitePages<unknown> }) {
  if (!query.hasMore) return null;
  if (query.isLoading) return <div className="">Loading more...</div>;
  return <Sentinel id={`infinite-scroll-sentinel-${query.sentinelKey}`} onNext={query.next} />;
}

function Sentinel({ id, onNext }: { id: string; onNext: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const latest = useRef(onNext);
  latest.current = onNext;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          observer.disconnect();
          latest.current();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return <div id={id} className="h-px" ref={ref} />;
}
