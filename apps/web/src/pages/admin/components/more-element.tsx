import { useEffect, useRef, useState } from "react";
import { useAdminLiteralsI18n } from "../admin-literals.i18n";

// `InfiniteQuery::more_element()` (app/ratel/src/common/hooks/use_infinite_query.rs):
// nothing when there is no next page, "Loading more..." while it loads, else a
// 1px sentinel that loads the next page once 10% of it scrolls into view.

export interface MoreElementProps {
  hasMore: boolean;
  isLoading: boolean;
  /** `InfiniteQuery::next` — the caller skips it while a page is loading. */
  onNext: () => void;
}

export function MoreElement({ hasMore, isLoading, onNext }: MoreElementProps) {
  const lit = useAdminLiteralsI18n();
  // Rust keys the sentinel id with a random u64 per query.
  const [key] = useState(() => Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString());

  if (!hasMore) return null;
  if (isLoading) return <div className="">{lit.text("loading_more")}</div>;
  return <Sentinel id={`infinite-scroll-sentinel-${key}`} onVisible={onNext} />;
}

function Sentinel({ id, onVisible }: { id: string; onVisible: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const callback = useRef(onVisible);
  callback.current = onVisible;

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          observer.disconnect();
          callback.current();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return <div id={id} className="h-px" ref={ref} />;
}
