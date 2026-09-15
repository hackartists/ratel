import { useEffect, useId, useRef } from "react";

// `InfiniteQuery::more_element()` (app/ratel/src/common/hooks/use_infinite_query.rs):
// nothing when there is no next page, a "Loading more..." row while a page is
// loading, otherwise a 1px sentinel that loads the next page once it scrolls
// into view. The loading text is a literal in the Rust hook as well.

export interface InfiniteMoreProps {
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
}

export function InfiniteMore({ hasMore, isLoading, onLoadMore }: InfiniteMoreProps) {
  const key = useId().replace(/[^a-zA-Z0-9]/g, "");
  const ref = useRef<HTMLDivElement>(null);
  const latest = useRef(onLoadMore);
  latest.current = onLoadMore;
  const showSentinel = hasMore && !isLoading;

  useEffect(() => {
    const el = ref.current;
    if (!showSentinel || !el) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        observer.disconnect();
        latest.current();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [showSentinel]);

  if (!hasMore) return null;
  if (isLoading) return <div className="">Loading more...</div>;
  return <div ref={ref} id={`infinite-scroll-sentinel-${key}`} className="h-px" />;
}
