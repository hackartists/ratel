import { useEffect, useId, useRef } from "react";

// app/ratel/src/common/hooks/use_infinite_query.rs `InfiniteQuery::more_element()`:
// nothing when there is no next page; "Loading more..." while a page loads;
// otherwise a 1px sentinel that loads the next page once it scrolls into view
// (IntersectionObserver, threshold 0.1, disconnects after the first hit).

export interface InfiniteMoreProps {
  hasMore: boolean;
  loading: boolean;
  onMore: () => void;
}

export function InfiniteMore({ hasMore, loading, onMore }: InfiniteMoreProps) {
  if (!hasMore) return null;
  // Rust hardcodes this outside translate! (use_infinite_query.rs:111).
  if (loading) return <div className="">Loading more...</div>;
  return <Sentinel onMore={onMore} />;
}

function Sentinel({ onMore }: { onMore: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const latest = useRef(onMore);
  latest.current = onMore;
  // Rust: `infinite-scroll-sentinel-{key}` with a per-query key.
  const id = `infinite-scroll-sentinel-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
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

  return <div ref={ref} id={id} className="h-px" />;
}
