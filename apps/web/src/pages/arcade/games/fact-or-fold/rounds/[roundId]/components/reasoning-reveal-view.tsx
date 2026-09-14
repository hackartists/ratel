import type { BetResponse, RationaleResponse, RoundParticipantSummary } from "@ratel/ts-bridges";
import { displayName, fill, initials, withVariant } from "@/components/arcade/format";
import { useFactFoldRoomI18n } from "@/i18n/generated/features/arcade/games/fact_or_fold/pages/game_room/fact-fold-room.i18n";
import { useUserContext } from "@/lib/auth";
import { dataBool } from "@/lib/dom";
import { useFactFoldRound, useRoundBets, useRoundParticipants, useRoundRationales } from "../hooks/use-fact-fold-round";
import { activeSide } from "./round-format";

// app/ratel/src/features/arcade/games/fact_or_fold/pages/game_room/reasoning_reveal/component.rs
// (`ReasoningRevealView`, stage 4) — camp bar, every player's rationale, and
// the "decisive cite" toggle that pre-fills the live-debate flip.

export function ReasoningRevealView() {
  const ctx = useFactFoldRound();
  const tr = useFactFoldRoomI18n();
  const bets = useRoundBets(ctx.roundId);
  const rationales = useRoundRationales(ctx.roundId);
  const participants = useRoundParticipants(ctx.roundId);
  const myPk = useUserContext().user?.id ?? "";

  const realBets = bets.items.filter((b) => activeSide(b) === "REAL");
  const fakeBets = bets.items.filter((b) => activeSide(b) !== "REAL");
  const sum = (list: BetResponse[]) => list.reduce((total, b) => total + b.amount_rp, 0);

  return (
    <section className="view" data-active="true" data-view="reveal">
      <CampBar
        realCount={realBets.length}
        realTotal={sum(realBets)}
        fakeCount={fakeBets.length}
        fakeTotal={sum(fakeBets)}
        realOwners={realBets.map((b) => b.user_pk)}
        fakeOwners={fakeBets.map((b) => b.user_pk)}
        participants={participants.items}
      />

      <div className="reveal-hint">
        <strong>{tr.revealHintPrefix}</strong>
        {` ${tr.revealHintBody}`}
      </div>

      <div className="reveal-grid">
        {participants.items.map((participant, idx) => (
          <RevealCard
            key={participant.user_pk}
            idx={idx}
            participant={participant}
            bet={bets.items.find((b) => b.user_pk === participant.user_pk)}
            rationale={rationales.items.find((r) => r.user_pk === participant.user_pk)}
            myPk={myPk}
          />
        ))}
      </div>

      <RevealCta participants={participants.items} />
    </section>
  );
}

function CampBar({
  realCount,
  realTotal,
  fakeCount,
  fakeTotal,
  realOwners,
  fakeOwners,
  participants,
}: {
  realCount: number;
  realTotal: number;
  fakeCount: number;
  fakeTotal: number;
  realOwners: string[];
  fakeOwners: string[];
  participants: RoundParticipantSummary[];
}) {
  const tr = useFactFoldRoomI18n();
  return (
    <div className="camp-bar">
      <div className="camp-side real">
        <div className="camp-side-head">
          <span className="camp-label">{tr.revealCampRealLabel}</span>
          <span className="camp-count">{fill(tr.revealCampCount, { count: realCount, rp: realTotal })}</span>
        </div>
        <div className="camp-avatars">
          <CampAvatars owners={realOwners} participants={participants} />
        </div>
      </div>
      <div className="camp-vs">{tr.revealCampVs}</div>
      <div className="camp-side fake">
        <div className="camp-side-head">
          <span className="camp-label">{tr.revealCampFakeLabel}</span>
          <span className="camp-count">{fill(tr.revealCampCount, { count: fakeCount, rp: fakeTotal })}</span>
        </div>
        <div className="camp-avatars">
          <CampAvatars owners={fakeOwners} participants={participants} />
        </div>
      </div>
    </div>
  );
}

/** `camp_avatars`. */
function CampAvatars({ owners, participants }: { owners: string[]; participants: RoundParticipantSummary[] }) {
  return (
    <>
      {owners.map((pk) => {
        const owner = participants.find((p) => p.user_pk === pk);
        const display = owner ? displayName(owner) : "";
        const idx = Math.max(
          participants.findIndex((p) => p.user_pk === pk),
          0,
        );
        return (
          <div key={pk} className={withVariant("p-avatar", idx)} style={{ width: "28px", height: "28px", fontSize: "11px" }}>
            {initials(display, display)}
          </div>
        );
      })}
    </>
  );
}

function RevealCard({
  idx,
  participant,
  bet,
  rationale,
  myPk,
}: {
  idx: number;
  participant: RoundParticipantSummary;
  bet: BetResponse | undefined;
  rationale: RationaleResponse | undefined;
  myPk: string;
}) {
  const tr = useFactFoldRoomI18n();
  const { citedUserPk, setCitedUserPk } = useFactFoldRound();
  const isMe = participant.user_pk === myPk;
  const sideAttr = bet && activeSide(bet) === "FAKE" ? "fake" : "real";
  const display = displayName(participant);
  const betPillLabel = bet ? fill(tr.revealCardBetPill, { side: activeSide(bet), rp: bet.amount_rp }) : "";
  const marked = citedUserPk === participant.user_pk;

  const onQuote = () => setCitedUserPk(marked ? null : participant.user_pk);

  return (
    <div className={isMe ? "reveal-card me" : "reveal-card"} data-side={sideAttr}>
      <div className="reveal-card-head">
        <div className="debate-card-author">
          <div className={withVariant("p-avatar", idx)}>{initials(display, participant.username)}</div>
          <div>
            <div className="p-name">
              {display}
              {isMe && <span className="lb-you-badge">YOU</span>}
            </div>
          </div>
        </div>
        <div className={`reveal-card-bet ${sideAttr}`}>{betPillLabel}</div>
      </div>
      <div className="reveal-card-text">{rationale?.text ?? ""}</div>
      {!isMe && bet && (
        <div className="reveal-card-actions">
          <button className="quote-btn" data-marked={dataBool(marked)} onClick={onQuote}>
            {tr.revealQuoteBtn}
          </button>
        </div>
      )}
    </div>
  );
}

function RevealCta({ participants }: { participants: RoundParticipantSummary[] }) {
  const tr = useFactFoldRoomI18n();
  const { citedUserPk } = useFactFoldRound();

  let hint = tr.revealCtaNoQuote;
  if (citedUserPk !== null) {
    const cited = participants.find((p) => p.user_pk === citedUserPk);
    hint = fill(tr.revealCtaOneQuote, { name: cited ? displayName(cited) : citedUserPk });
  }

  return (
    <div className="reveal-cta">
      <span className="reveal-cta-hint">{hint}</span>
      <span className="reveal-cta-hint">{tr.revealCtaHint}</span>
    </div>
  );
}
