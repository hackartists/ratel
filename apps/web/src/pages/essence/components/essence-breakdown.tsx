import type { ReactNode } from "react";
import { useEssenceSourcesI18n } from "@/pages/essence/i18n";
import { dataBool } from "@/lib/dom";
import { useEssenceSources, type KindFilter } from "../hooks/use-essence-sources";

// app/ratel/src/features/essence/pages/sources/breakdown/component.rs

interface BreakdownCounts {
  total: number;
  notion: number;
  post: number;
  comment: number;
  poll: number;
  quiz: number;
}

export function EssenceBreakdown() {
  const tr = useEssenceSourcesI18n();
  const { stats, items, selectedKind, setKind } = useEssenceSources();

  // Per-kind totals come from `UserEssenceStats`. Pre-migration fallback:
  // every per-kind counter is zero but `total_sources` isn't, so bucket the
  // rows of the loaded page instead.
  const counts = ((): BreakdownCounts => {
    const total = Math.max(stats.total_sources, 0);
    const perKindZero =
      stats.total_notion === 0 &&
      stats.total_post === 0 &&
      stats.total_comment === 0 &&
      stats.total_poll === 0 &&
      stats.total_quiz === 0;
    if (perKindZero && total > 0) {
      const c: BreakdownCounts = { total, notion: 0, post: 0, comment: 0, poll: 0, quiz: 0 };
      for (const row of items) {
        switch (row.source_kind) {
          case "Notion":
            c.notion += 1;
            break;
          case "Post":
          // FOF rationale shares the post chip in v1.
          case "FactFoldRationale":
            c.post += 1;
            break;
          case "PostComment":
          case "DiscussionComment":
            c.comment += 1;
            break;
          case "Poll":
            c.poll += 1;
            break;
          case "Quiz":
            c.quiz += 1;
            break;
        }
      }
      return c;
    }
    return {
      total,
      notion: Math.max(stats.total_notion, 0),
      post: Math.max(stats.total_post, 0),
      comment: Math.max(stats.total_comment, 0),
      poll: Math.max(stats.total_poll, 0),
      quiz: Math.max(stats.total_quiz, 0),
    };
  })();

  return (
    <section className="essence-breakdown">
      <KindCard
        kind="All"
        selected={selectedKind === "All"}
        value={counts.total}
        total={counts.total}
        label={tr.kindAll}
        onSelect={setKind}
        iconClassName="essence-kind-card__icon essence-kind-card__icon--all"
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
        }
      />
      <KindCard
        kind="Notion"
        selected={selectedKind === "Notion"}
        value={counts.notion}
        total={counts.total}
        label={tr.kindNotion}
        onSelect={setKind}
        iconClassName="essence-kind-card__icon essence-kind-card__icon--notion"
        icon="N"
      />
      <KindCard
        kind="Post"
        selected={selectedKind === "Post"}
        value={counts.post}
        total={counts.total}
        label={tr.kindPost}
        onSelect={setKind}
        iconClassName="essence-kind-card__icon essence-kind-card__icon--posts"
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" />
          </svg>
        }
      />
      <KindCard
        kind="Comment"
        selected={selectedKind === "Comment"}
        value={counts.comment}
        total={counts.total}
        label={tr.kindComment}
        onSelect={setKind}
        iconClassName="essence-kind-card__icon essence-kind-card__icon--comments"
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        }
      />
      <KindCard
        kind="Poll"
        selected={selectedKind === "Poll"}
        value={counts.poll}
        total={counts.total}
        label={tr.kindPoll}
        onSelect={setKind}
        iconClassName="essence-kind-card__icon essence-kind-card__icon--actions"
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
        }
      />
      <KindCard
        kind="Quiz"
        selected={selectedKind === "Quiz"}
        value={counts.quiz}
        total={counts.total}
        label={tr.kindQuiz}
        onSelect={setKind}
        iconClassName="essence-kind-card__icon essence-kind-card__icon--actions"
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        }
      />
    </section>
  );
}

interface KindCardProps {
  kind: KindFilter;
  selected: boolean;
  value: number;
  total: number;
  label: string;
  onSelect: (kind: KindFilter) => void;
  /** Rust `"essence-kind-card__icon essence-kind-card__icon--{icon_variant}"`, spelled out in full. */
  iconClassName: string;
  icon: ReactNode;
}

function KindCard({ kind, selected, value, total, label, onSelect, iconClassName, icon }: KindCardProps) {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <article className="essence-kind-card" data-selected={dataBool(selected)} onClick={() => onSelect(kind)}>
      <div className="essence-kind-card__head">
        <span className={iconClassName}>{icon}</span>
        <span className="essence-kind-card__pct">{`${pct}%`}</span>
      </div>
      <span className="essence-kind-card__value">{value}</span>
      <span className="essence-kind-card__label">{label}</span>
    </article>
  );
}
