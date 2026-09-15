import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { LobbyResponse, UserStatsResponse } from "@ratel/ts-bridges";
import { fill } from "@/components/arcade/format";
import { factFoldMatchingPath, factFoldRoundPath } from "@/components/arcade/paths";
import { useArcadeHomeI18n, type ArcadeHomeI18n } from "@/i18n/generated/features/arcade/arcade-home.i18n";
import { errorMessage } from "@/lib/server-error";
import { useJoinRound } from "../hooks/use-arcade-home";
import { StatsCard } from "./stats-card";

// app/ratel/src/features/arcade/pages/home/component.rs — `LobbyView` and the
// cards under it (FeaturedCard, FeaturedCta, HistoryCard, CatalogSection).

export function LobbyView({ lobby, myStats }: { lobby: LobbyResponse; myStats: UserStatsResponse }) {
  return (
    <>
      <div className="lobby-grid">
        <FeaturedCard lobby={lobby} />
        <div className="lobby-side">
          <StatsCard stats={myStats} />
          <HistoryCard />
        </div>
      </div>
      <CatalogSection lobby={lobby} />
    </>
  );
}

function FeaturedCard({ lobby }: { lobby: LobbyResponse }) {
  const tr = useArcadeHomeI18n();
  const join = useJoinRound();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const onJoin = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const round = await join();
      navigate(round.status === "Waiting" ? factFoldMatchingPath(round.id) : factFoldRoundPath(round.id));
    } catch (e) {
      setErrorMsg(errorMessage(e));
    }
    submittingRef.current = false;
    setSubmitting(false);
  };

  return (
    <div className="featured">
      <div className="featured-tag">
        <span className="featured-tag-dot" />
        <span>{featuredTag(lobby, tr)}</span>
      </div>
      <h1 className="featured-title">{tr.featuredTitle}</h1>
      <p className="featured-tagline">{tr.featuredTagline}</p>

      <div className="featured-meta">
        <MetaCell label={tr.metaCapacity} value={fill(tr.metaCapacityValue, { count: lobby.round_capacity })} />
        <MetaCell label={tr.metaMinBet} value={fill(tr.metaMinBetValue, { rp: lobby.min_bet_rp })} />
        <MetaCell label={tr.metaCycle} value={tr.metaCycleValue} />
        <MetaCell label={tr.metaStageNow} value={featuredStageLabel(lobby, tr)} />
      </div>

      {errorMsg !== null && (
        <div className="reason-warn" style={{ marginBottom: "14px" }}>
          {errorMsg}
        </div>
      )}

      <FeaturedCta lobby={lobby} onJoin={() => void onJoin()} submitting={submitting} />
    </div>
  );
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="meta-cell">
      <div className="meta-cell-label">{label}</div>
      <div className="meta-cell-value">{value}</div>
    </div>
  );
}

function FeaturedCta({ lobby, onJoin, submitting }: { lobby: LobbyResponse; onJoin: () => void; submitting: boolean }) {
  const tr = useArcadeHomeI18n();
  const round = lobby.current_round;
  const waitingCount = round?.participant_pks.length ?? 0;

  let body;
  if (lobby.already_joined) {
    // Normally already redirected; fallback CTA in case this renders first.
    body = (
      <>
        {round && (
          <Link className="btn btn-primary" to={factFoldMatchingPath(round.id)}>
            {tr.ctaResume}
          </Link>
        )}
        <span className="featured-status">
          <span className="green">●</span>
          {` ${tr.statusAlreadyJoined}`}
        </span>
      </>
    );
  } else if (lobby.can_join) {
    body = (
      <>
        <button className="btn btn-primary" data-testid="ff-arcade-join" disabled={submitting} onClick={onJoin}>
          {tr.ctaJoin}
        </button>
        <span className="featured-status">
          {round ? fill(tr.statusCanJoinExisting, { count: waitingCount }) : tr.statusCanJoinNew}
        </span>
      </>
    );
  } else if (round) {
    body = (
      <>
        <button className="btn btn-ghost" disabled>
          {tr.ctaInProgress}
        </button>
        <span className="featured-status">{tr.statusInProgress}</span>
      </>
    );
  } else {
    body = (
      <>
        <button className="btn btn-ghost" disabled>
          {tr.ctaNoSubject}
        </button>
        <span className="featured-status">{tr.statusNoSubject}</span>
      </>
    );
  }

  return <div className="featured-cta">{body}</div>;
}

function HistoryCard() {
  const tr = useArcadeHomeI18n();
  return (
    <div className="history-card">
      <div className="section-head">
        <h2>{tr.historyCardTitle}</h2>
        <span className="sub">{tr.historyCardSub}</span>
      </div>
      <div className="ff-home__placeholder">{tr.historyEmpty}</div>
    </div>
  );
}

function CatalogSection({ lobby }: { lobby: LobbyResponse }) {
  const tr = useArcadeHomeI18n();
  const gameCount = 1;
  const playing = lobby.current_round !== null || lobby.already_joined;

  return (
    <div className="catalog-section">
      <div className="section-head">
        <h2>{tr.catalogTitle}</h2>
        <span className="sub">{fill(tr.catalogSub, { count: gameCount })}</span>
      </div>
      <div className="catalog-grid">
        <div className="game-tile">
          <div className="game-tile-icon gold">◆</div>
          {/* Untranslated in Rust too (component.rs CatalogSection). */}
          <div className="game-tile-name">Fact or Fold</div>
          <div className="game-tile-desc">4 players judge a news headline. Bets and rationale decide the winners.</div>
          <div className="game-tile-foot">
            <span>{tr.catalogTileMeta}</span>
            <span className={playing ? "pill gold" : "pill"}>
              {playing ? tr.catalogTileStatusPlaying : tr.catalogTileStatusIdle}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** `featured_tag` (label only; the Rust status half is unused). */
function featuredTag(lobby: LobbyResponse, tr: ArcadeHomeI18n): string {
  const round = lobby.current_round;
  if (round) {
    if (round.status === "Waiting") return tr.tagWaiting;
    if (round.status === "Settled") return tr.tagSettled;
    return tr.tagLive;
  }
  return lobby.subject_available ? tr.tagOpen : tr.tagClosed;
}

function featuredStageLabel(lobby: LobbyResponse, tr: ArcadeHomeI18n): string {
  const round = lobby.current_round;
  if (!round) return tr.metaStageIdle;
  switch (round.status) {
    case "Waiting":
    case "NewsReveal":
      return "1 / 6";
    case "Bet":
      return "2 / 6";
    case "Rationale":
      return "3 / 6";
    case "Reveal":
      return "4 / 6";
    case "Debate":
      return "5 / 6";
    case "Settlement":
    case "Settled":
      return "6 / 6";
  }
}
