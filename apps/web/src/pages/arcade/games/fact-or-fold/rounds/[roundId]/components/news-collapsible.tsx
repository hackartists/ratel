import type { RoundSubjectResponse } from "@ratel/ts-bridges";
import { useFactFoldRoomI18n } from "@/pages/arcade/games/fact-or-fold/rounds/[roundId]/i18n";
import { useFactFoldRound, useRoundSubject } from "../hooks/use-fact-fold-round";
import { renderDifficulty } from "./round-format";

// app/ratel/src/features/arcade/games/fact_or_fold/pages/game_room/news_collapsible.rs
// (`RoundNewsCollapsible`) and component.rs `StageNewsHeader` — the closed-by-
// default news card above stages 2+. Native <details>, no JS.

/** `StageNewsHeader` — reads the subject from the round controller. */
export function StageNewsHeader() {
  const { roundId } = useFactFoldRound();
  const subject = useRoundSubject(roundId);
  return <RoundNewsCollapsible subject={subject} defaultOpen={false} />;
}

export function RoundNewsCollapsible({ subject, defaultOpen = false }: { subject: RoundSubjectResponse; defaultOpen?: boolean }) {
  const tr = useFactFoldRoomI18n();
  const primaryTag = subject.category_tags[0] ?? tr.newsPillCategoryDefault;
  const headline = subject.headline_text === "" ? tr.newsHeadlinePending : subject.headline_text;

  return (
    <details className="card news-collapsible" open={defaultOpen}>
      <summary className="news-summary">
        <span className="news-summary-label">{tr.newsLabel}</span>
        <span className="news-summary-title">{headline}</span>
        <span className="news-summary-toggle">▾</span>
      </summary>
      <div className="news-body">
        <div className="news-meta">
          <span className="pill">{primaryTag}</span>
          <span className="pill purple">{`${tr.newsDifficulty} ${renderDifficulty(subject.difficulty)}`}</span>
        </div>
        <h2 className="news-headline-full">{headline}</h2>
        {subject.body_excerpt !== "" && <p className="news-excerpt">{subject.body_excerpt}</p>}
        <div className="news-source">
          <span>📰</span>
          <span>{subject.source_label}</span>
          <span className="news-source-dot" />
          <span>{tr.newsSourceLock}</span>
        </div>
      </div>
    </details>
  );
}
