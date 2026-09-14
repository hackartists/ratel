import type { RoundParticipantSummary, RoundResponse, RoundStatus, RoundSubjectResponse } from "@ratel/ts-bridges";
import { displayName, fill, initials, withVariant } from "@/components/arcade/format";
import {
  useFactFoldRoomI18n,
  type FactFoldRoomI18n,
} from "@/i18n/generated/features/arcade/games/fact_or_fold/pages/game_room/fact-fold-room.i18n";
import { useUserContext } from "@/lib/auth";
import { useFactFoldRound, useRound, useRoundParticipants, useRoundSubject } from "../hooks/use-fact-fold-round";
import { renderDifficulty } from "./round-format";

// app/ratel/src/features/arcade/games/fact_or_fold/pages/game_room/news_reveal/component.rs
// (`NewsRevealView`, stage 1) — the public subject and the participant roster.

export function NewsRevealView() {
  const { roundId } = useFactFoldRound();
  const subject = useRoundSubject(roundId);
  const participants = useRoundParticipants(roundId);
  const round = useRound(roundId);
  const myPk = useUserContext().user?.id ?? "";

  return (
    <section className="view" data-active="true" data-view="round">
      <div className="round-grid">
        <div>
          <NewsCard subject={subject} />
          <PlayersCard participants={participants.items} round={round} myPk={myPk} />
        </div>
      </div>
    </section>
  );
}

function NewsCard({ subject }: { subject: RoundSubjectResponse }) {
  const tr = useFactFoldRoomI18n();
  const primaryTag = subject.category_tags[0] ?? tr.newsPillCategoryDefault;

  return (
    <div className="news-card">
      <div className="news-source">
        <span>📰</span>
        <span>{subject.source_label}</span>
        <span className="news-source-dot" />
        <span>{tr.newsSourceLock}</span>
      </div>
      <h2 className="news-subject">{subject.headline_text}</h2>
      <p className="news-excerpt">{subject.body_excerpt}</p>
      <div className="news-meta">
        <span className="pill">{primaryTag}</span>
        <span className="pill purple">{`${tr.newsDifficulty} ${renderDifficulty(subject.difficulty)}`}</span>
        <span className="news-cta">
          <span className="pill teal">{tr.newsCtaLabel}</span>
        </span>
      </div>
    </div>
  );
}

function PlayersCard({ participants, round, myPk }: { participants: RoundParticipantSummary[]; round: RoundResponse; myPk: string }) {
  const tr = useFactFoldRoomI18n();
  const capacity = Math.max(round.participant_pks.length, participants.length);

  return (
    <div className="players-card">
      <div className="players-head">
        <div className="section-label">{tr.playersCardTitle}</div>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", color: "var(--text-muted)" }}>
          {fill(tr.playersCardCount, { count: participants.length, capacity })}
        </span>
      </div>
      <div className="players-list">
        {participants.map((p, idx) => (
          <PlayerRow key={p.user_pk} idx={idx} participant={p} roundStatus={round.status} isMe={p.user_pk === myPk} />
        ))}
      </div>
    </div>
  );
}

function PlayerRow({
  idx,
  participant,
  roundStatus,
  isMe,
}: {
  idx: number;
  participant: RoundParticipantSummary;
  roundStatus: RoundStatus;
  isMe: boolean;
}) {
  const tr = useFactFoldRoomI18n();
  const display = displayName(participant);
  const [pillLabel, pillClass] = pillState(roundStatus, participant.forfeited, tr);

  return (
    <div className={isMe ? "player-row me" : "player-row"}>
      <div className={withVariant("p-avatar", idx)}>{initials(display, participant.username)}</div>
      <div className="p-info">
        <div className="p-name">
          {display}
          {isMe && <span className="lb-you-badge">{tr.playersYouBadge}</span>}
        </div>
        <div className="p-status">{statusText(roundStatus, tr)}</div>
      </div>
      <div className={pillClass}>{pillLabel}</div>
    </div>
  );
}

function statusText(s: RoundStatus, tr: FactFoldRoomI18n): string {
  switch (s) {
    case "Waiting":
    case "NewsReveal":
      return tr.playersStatusReading;
    case "Bet":
      return tr.playersStatusBetPending;
    case "Rationale":
      return tr.playersStatusWriting;
    case "Reveal":
      return tr.playersStatusRevealed;
    case "Debate":
      return tr.playersStatusDebating;
    case "Settlement":
    case "Settled":
      return tr.playersStatusDone;
  }
}

function pillState(s: RoundStatus, forfeited: boolean, tr: FactFoldRoomI18n): [string, string] {
  if (forfeited) return [tr.playersPillForfeited, "p-state-pill"];
  if (s === "Settlement" || s === "Settled") return [tr.playersPillDone, "p-state-pill done"];
  return [tr.playersPillWaiting, "p-state-pill waiting"];
}
