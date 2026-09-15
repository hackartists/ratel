import { useEffect, useRef, useState } from "react";

// `InfiniteQuery::more_element()` (app/ratel/src/common/hooks/use_infinite_query.rs):
// nothing when there is no next page, "Loading more..." while it loads, and
// otherwise a 1px sentinel whose IntersectionObserver (threshold 0.1) calls
// `next()` once and disconnects. The sentinel remounts after every page, so
// each mount observes afresh.

/** Per-query random key (`use_server_cached(rand::random::<u64>())`). */
export function useSentinelKey(): string {
  const [key] = useState(() => {
    const parts = new Uint32Array(2);
    crypto.getRandomValues(parts);
    return ((BigInt(parts[0]) << 32n) | BigInt(parts[1])).toString();
  });
  return key;
}

export interface MoreElementProps {
  hasMore: boolean;
  loading: boolean;
  onNext: () => void;
  sentinelKey: string;
}

export function MoreElement({ hasMore, loading, onNext, sentinelKey }: MoreElementProps) {
  if (!hasMore) return null;
  if (loading) return <div className="">Loading more...</div>;
  return <Sentinel id={`infinite-scroll-sentinel-${sentinelKey}`} onNext={onNext} />;
}

function Sentinel({ id, onNext }: { id: string; onNext: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const onNextRef = useRef(onNext);
  onNextRef.current = onNext;

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
  }, []);

  return <div ref={ref} id={id} className="h-px" />;
}
