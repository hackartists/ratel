import { useEffect, useRef, useState } from "react";

// `InfiniteQuery::more_element` (app/ratel/src/common/hooks/use_infinite_query.rs):
// nothing when there is no next page, a "Loading more..." line while the next
// page loads, otherwise a 1px sentinel that loads the next page once it
// scrolls into view (IntersectionObserver, threshold 0.1, fires once).

export interface MoreElementProps {
  /** `has_more()` — the last page returned a bookmark. */
  hasMore: boolean;
  /** `is_loading()` — a next page is being fetched. */
  loading: boolean;
  /** `next()` — fetch the next page. */
  onNext: () => void;
}

export function MoreElement({ hasMore, loading, onNext }: MoreElementProps) {
  // The Rust sentinel id embeds a random per-query key.
  const [key] = useState(() => String(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)));
  const ref = useRef<HTMLDivElement>(null);
  const onNextRef = useRef(onNext);
  onNextRef.current = onNext;

  const showSentinel = hasMore && !loading;
  useEffect(() => {
    const el = ref.current;
    if (!showSentinel || !el) return;
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
  }, [showSentinel]);

  if (!hasMore) return null;
  // FIXME carried over from the Rust hook: untranslated placeholder text.
  if (loading) return <div className="">Loading more...</div>;
  return <div ref={ref} id={`infinite-scroll-sentinel-${key}`} className="h-px" />;
}
