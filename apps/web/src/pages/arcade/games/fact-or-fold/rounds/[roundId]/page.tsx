import { useParams } from "react-router-dom";
import type { RoundResponse } from "@ratel/ts-bridges";
import { SeoMeta } from "@/components/ui/seo-meta";
import { useFactFoldRoomI18n } from "./i18n";
import { useLegacyScript } from "@/lib/legacy-scripts";
import stageScrollScript from "../../../../../../legacy-scripts/features/arcade/games/fact_or_fold/pages/game_room/stage_scroll.js?url&no-inline";
import { FirstBetView } from "./components/first-bet-view";
import { LiveDebateView } from "./components/live-debate-view";
import { StageNewsHeader } from "./components/news-collapsible";
import { NewsRevealView } from "./components/news-reveal-view";
import { ReasoningRevealView } from "./components/reasoning-reveal-view";
import { ReasoningWriteView } from "./components/reasoning-write-view";
import { SettlementView } from "./components/settlement-view";
import { StageTimeline, TimerCard } from "./components/sidebar";
import { FactFoldRoundProvider, useFactFoldRoundProvider, useRound } from "./hooks/use-fact-fold-round";

// app/ratel/src/features/arcade/games/fact_or_fold/pages/game_room/component.rs
// (`FactFoldGameRoomPage`, `/arcade/games/fact-or-fold/rounds/:round_id`) —
// the live round: stage timeline + timer sidebar and one view per
// `RoundStatus`. The controller owns the polling and heartbeat loops;
// `stage_scroll.js` (unmodified) keeps the active stage step centered on mobile.
export function Component() {
  const { roundId = "" } = useParams();
  useLegacyScript(stageScrollScript);
  const controller = useFactFoldRoundProvider(roundId);
  const round = useRound(roundId);

  return (
    <FactFoldRoundProvider value={controller}>
      <SeoMeta title="Fact or Fold · Ratel Arcade" />
      <div className="ff-room">
        <div className="layout">
          <aside className="sidebar">
            <StageTimeline round={round} />
            <TimerCard round={round} />
          </aside>
          <div className="view-stack">
            <StageView round={round} />
          </div>
        </div>
      </div>
    </FactFoldRoundProvider>
  );
}

/** `render_stage` — one view per status; stages 2+ get the collapsible news header. */
function StageView({ round }: { round: RoundResponse }) {
  const tr = useFactFoldRoomI18n();
  switch (round.status) {
    case "Waiting":
      return (
        <section className="view" data-active="true">
          <div className="ff-room__placeholder">{tr.waitingForPlayers}</div>
        </section>
      );
    case "NewsReveal":
      return <NewsRevealView />;
    case "Bet":
      return (
        <>
          <StageNewsHeader />
          <FirstBetView />
        </>
      );
    case "Rationale":
      return (
        <>
          <StageNewsHeader />
          <ReasoningWriteView />
        </>
      );
    case "Reveal":
      return (
        <>
          <StageNewsHeader />
          <ReasoningRevealView />
        </>
      );
    case "Debate":
      return (
        <>
          <StageNewsHeader />
          <LiveDebateView />
        </>
      );
    case "Settlement":
      return (
        <section className="view" data-active="true">
          <div className="ff-room__placeholder">{tr.settling}</div>
        </section>
      );
    case "Settled":
      return (
        <>
          <StageNewsHeader />
          <SettlementView />
        </>
      );
  }
}
