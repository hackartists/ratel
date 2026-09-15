import { useEffect, useId, useRef } from "react";
import type { LeaderboardEntryResponse } from "@ratel/ts-bridges";
import { displayName, fill, initials, withVariant } from "@/components/arcade/format";
import { useArcadeHomeI18n } from "@/i18n/generated/features/arcade/arcade-home.i18n";
import { useUserContext } from "@/lib/auth";

// app/ratel/src/features/arcade/pages/home/component.rs — `LeaderboardView`,
// `LeaderboardRow`, plus the `InfiniteQuery::more_element()` sentinel.

export function LeaderboardView({ entries }: { entries: LeaderboardEntryResponse[] }) {
  const tr = useArcadeHomeI18n();
  const myPk = useUserContext().user?.id ?? "";

  return (
    <div className="lb-table">
      <div className="section-head">
        <h2>{tr.lbSectionTitle}</h2>
        <span className="sub">{tr.lbSectionSub}</span>
      </div>

      <div className="lb-row head">
        <div>{tr.lbHeadRank}</div>
        <div />
        <div>{tr.lbHeadName}</div>
        <div>{tr.lbHeadStats}</div>
        <div>{tr.lbHeadAccuracy}</div>
        <div>{tr.lbHeadChips}</div>
      </div>

      {entries.length === 0 && <div className="ff-home__placeholder">{tr.lbEmpty}</div>}
      {entries.map((entry, idx) => (
        <LeaderboardRow key={entry.user_pk} idx={idx} entry={entry} isMe={entry.user_pk === myPk} />
      ))}
    </div>
  );
}

function LeaderboardRow({ idx, entry, isMe }: { idx: number; entry: LeaderboardEntryResponse; isMe: boolean }) {
  const tr = useArcadeHomeI18n();
  const rank = idx + 1;
  const rankClass = rank <= 3 ? `lb-rank top${rank}` : "lb-rank";
  const display = displayName(entry);
  const chipsLabel = `${entry.lifetime_delta_chips >= 0 ? "+" : ""}${entry.lifetime_delta_chips}`;

  return (
    <div className={isMe ? "lb-row me" : "lb-row"}>
      <div className={rankClass}>{rank}</div>
      <div className={withVariant("p-avatar", idx)}>{initials(display, entry.username)}</div>
      <div className="lb-name-cell">
        <span className="lb-name">{display}</span>
        {isMe && <span className="lb-you-badge">YOU</span>}
      </div>
      <div className="lb-stat">{fill(tr.lbRowStat, { total: entry.total_rounds, correct: entry.correct_count })}</div>
      <div className="lb-accuracy">{`${(entry.accuracy_bps / 100).toFixed(1)}%`}</div>
      <div className="lb-primary">{chipsLabel}</div>
    </div>
  );
}

/** `more_element()` — nothing, a "Loading more..." row, or an intersection sentinel. */
export function MoreSentinel({ hasMore, isLoading, next }: { hasMore: boolean; isLoading: boolean; next: () => void }) {
  if (!hasMore) return null;
  // Rust's FIXME placeholder, untranslated there too.
  if (isLoading) return <div className="">Loading more...</div>;
  return <Sentinel next={next} />;
}

function Sentinel({ next }: { next: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const key = useId().replace(/:/g, "");
  const nextRef = useRef(next);
  nextRef.current = next;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          observer.disconnect();
          nextRef.current();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return <div ref={ref} id={`infinite-scroll-sentinel-${key}`} className="h-px" />;
}
