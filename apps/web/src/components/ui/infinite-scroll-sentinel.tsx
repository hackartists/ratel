import { useEffect, useRef, useState } from "react";

// `InfiniteQuery::more_element()` (app/ratel/src/common/hooks/use_infinite_query.rs):
// nothing when there is no next page; "Loading more..." while one loads;
// otherwise a 1px sentinel whose IntersectionObserver (threshold 0.1)
// disconnects and loads the next page once it scrolls into view. The Rust
// text is hardcoded English and its wrapper has an empty `class`.

export interface InfiniteScrollSentinelProps {
  hasMore: boolean;
  isLoading: boolean;
  onNext: () => void;
}

export function InfiniteScrollSentinel({ hasMore, isLoading, onNext }: InfiniteScrollSentinelProps) {
  // Rust keys the sentinel id with a random u64 per query.
  const [key] = useState(() => String(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)));
  const ref = useRef<HTMLDivElement>(null);
  const onNextRef = useRef(onNext);

  useEffect(() => {
    onNextRef.current = onNext;
  }, [onNext]);

  // Re-attached whenever the sentinel re-mounts (after each page), like `onmounted`.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          observer.disconnect();
          onNextRef.current();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, isLoading]);

  if (!hasMore) return null;
  if (isLoading) return <div className="">Loading more...</div>;
  return <div ref={ref} id={`infinite-scroll-sentinel-${key}`} className="h-px" />;
}
