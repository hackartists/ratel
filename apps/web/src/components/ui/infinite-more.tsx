import { useEffect, useRef, useState } from "react";

// app/ratel/src/common/hooks/use_infinite_query.rs `InfiniteQuery::more_element()`:
// nothing when there is no next page; "Loading more..." while a page loads;
// otherwise a 1px sentinel that loads the next page once it scrolls into view
// (IntersectionObserver, threshold 0.1, disconnected after the first hit).
//
// Rust ids the sentinel `infinite-scroll-sentinel-{key}` with a random
// per-query key; a per-instance counter plays that role here.

let nextKey = 0;

export interface InfiniteMoreProps {
  hasMore: boolean;
  isLoading: boolean;
  onMore: () => void;
}

export function InfiniteMore({ hasMore, isLoading, onMore }: InfiniteMoreProps) {
  const [key] = useState(() => nextKey++);
  const ref = useRef<HTMLDivElement>(null);
  const latest = useRef(onMore);
  latest.current = onMore;
  const showSentinel = hasMore && !isLoading;

  useEffect(() => {
    const el = ref.current;
    if (!showSentinel || !el || typeof IntersectionObserver === "undefined") return;
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
  }, [showSentinel]);

  if (!hasMore) return null;
  if (isLoading) return <div className="">Loading more...</div>;
  return <div ref={ref} id={`infinite-scroll-sentinel-${key}`} className="h-px" />;
}
