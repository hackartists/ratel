import { useRef, useState } from "react";
import type { BetResponse, RationaleResponse, RoundParticipantSummary } from "@ratel/ts-bridges";
import { fill, initials } from "@/components/arcade/format";
import { useFactFoldRoomI18n } from "@/i18n/generated/features/arcade/games/fact_or_fold/pages/game_room/fact-fold-room.i18n";
import { useUserContext } from "@/lib/auth";
import {
  useFactFoldRound,
  useRoundBets,
  useRoundInsider,
  useRoundParticipants,
  useRoundRationales,
} from "../hooks/use-fact-fold-round";
import { charCount, RATIONALE_TEXT_MAX_CHARS } from "./round-format";

// app/ratel/src/features/arcade/games/fact_or_fold/pages/game_room/reasoning_write/component.rs
// (`ReasoningWriteView`, stage 3) — the rationale textarea on the left, tips
// and the other players' submitted/writing pulses on the right.

export function ReasoningWriteView() {
  const ctx = useFactFoldRound();
  const tr = useFactFoldRoomI18n();
  const bets = useRoundBets(ctx.roundId);
  const rationales = useRoundRationales(ctx.roundId);
  const participants = useRoundParticipants(ctx.roundId);
  const insider = useRoundInsider(ctx.roundId);
  const myPk = useUserContext().user?.id ?? "";

  const myBet = bets.items.find((b) => b.user_pk === myPk);
  const myRationale = rationales.items.find((r) => r.user_pk === myPk);

  return (
    <section className="view" data-active="true" data-view="reason">
      <div className="bet-grid">
        <div>
          {myBet ? (
            myRationale ? (
              <ReasonSubmittedCard rationale={myRationale} bet={myBet} />
            ) : (
              <ReasonWriteCard
                bet={myBet}
                onSubmit={(text) => void ctx.submitRationale(text).catch(() => undefined)}
              />
            )
          ) : (
            <div className="reason-live-card">
              <div className="reason-warn">{tr.reasonNoBetWarning}</div>
            </div>
          )}
        </div>
        <div>
          <ReasonSidePanel
            participants={participants.items}
            rationales={rationales.items}
            myPk={myPk}
            isInsider={insider.statement !== null}
          />
        </div>
      </div>
    </section>
  );
}

function ReasonWriteCard({ bet, onSubmit }: { bet: BetResponse; onSubmit: (text: string) => void }) {
  const tr = useFactFoldRoomI18n();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const len = charCount(text);

  const onConfirm = () => {
    if (submittingRef.current) return;
    if (text.trim() === "" || len > RATIONALE_TEXT_MAX_CHARS) return;
    submittingRef.current = true;
    setSubmitting(true);
    onSubmit(text);
    submittingRef.current = false;
    setSubmitting(false);
  };

  const promptTemplate = bet.side === "REAL" ? tr.reasonPromptTextReal : tr.reasonPromptTextFake;

  return (
    <div className="reason-live-card">
      <div className="reason-prompt">
        <div className="reason-prompt-label">{tr.reasonPromptLabel}</div>
        <div className="reason-prompt-text">
          <span className={bet.side === "REAL" ? "gold-mark" : "pink-mark"}>{bet.side}</span>
          {` · ${bet.amount_rp} RP — `}
          {fill(promptTemplate, { amount: bet.amount_rp })}
        </div>
      </div>

      <div className="reason-wrap">
        <div className="reason-head">
          <span className="reason-label">{tr.reasonTextareaLabel}</span>
          <span className={len > 0 && len <= RATIONALE_TEXT_MAX_CHARS ? "char-counter ok" : "char-counter warn"}>
            {`${len} / ${RATIONALE_TEXT_MAX_CHARS}`}
          </span>
        </div>
        <textarea
          className="reason-textarea"
          placeholder={tr.reasonTextareaPlaceholder}
          onChange={(e) => setText(e.target.value)}
          value={text}
        />
        <div className="reason-warn">{tr.reasonWarn}</div>
      </div>

      <div className="submit-row">
        <button
          className="btn btn-primary"
          disabled={submitting || len === 0 || len > RATIONALE_TEXT_MAX_CHARS}
          onClick={onConfirm}
        >
          {tr.reasonSubmit}
        </button>
        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{tr.reasonSubmitHint}</span>
      </div>
    </div>
  );
}

function ReasonSubmittedCard({ rationale, bet }: { rationale: RationaleResponse; bet: BetResponse }) {
  const tr = useFactFoldRoomI18n();
  return (
    <div className="reason-live-card">
      <div className="reason-prompt">
        <div className="reason-prompt-label">{tr.reasonSubmittedTitle}</div>
        <div className="reason-prompt-text">
          <span className={bet.side === "REAL" ? "pill gold" : "pill pink"}>{bet.side}</span>
          {` · ${bet.amount_rp} RP`}
        </div>
      </div>
      <div className="reason-wrap">
        <div className="reason-head">
          <span className="reason-label">{tr.reasonTextareaLabel}</span>
        </div>
        {/* Read-only: the server doesn't accept a resubmission. */}
        <div className="reason-textarea" style={{ background: "rgba(0,0,0,0.18)", whiteSpace: "pre-wrap" }}>
          {rationale.text}
        </div>
      </div>
      <div
        className="reason-warn"
        style={{ background: "rgba(110,237,216,0.08)", color: "var(--teal)", borderColor: "rgba(110,237,216,0.25)" }}
      >
        {tr.reasonSubmittedBody}
      </div>
    </div>
  );
}

/** `pulse_avatar_style` — Rust inline style strings, as style objects. */
const PULSE_AVATAR_STYLES = [
  { background: "linear-gradient(135deg, #4f3aaf, #7d3aaf)" },
  { background: "linear-gradient(135deg, #3aaf7d, #6eedd8)", color: "#042a1f" },
  { background: "linear-gradient(135deg, #af3a7d, #db2780)" },
  { background: "linear-gradient(135deg, #af7d3a, #fcb300)", color: "#1a0a00" },
];

function ReasonSidePanel({
  participants,
  rationales,
  myPk,
  isInsider,
}: {
  participants: RoundParticipantSummary[];
  rationales: RationaleResponse[];
  myPk: string;
  isInsider: boolean;
}) {
  const tr = useFactFoldRoomI18n();

  return (
    <div className="bet-summary">
      <h3 className="card-title">{tr.reasonTipsTitle}</h3>
      <div style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.7, marginBottom: "14px" }}>
        {tr.reasonTipsBody}
      </div>

      <div className="section-label">{tr.reasonOthersLabel}</div>
      <div className="player-pulses">
        {participants.map((p, idx) => {
          if (p.user_pk === myPk) return null;
          const submitted = rationales.some((r) => r.user_pk === p.user_pk);
          return (
            <div key={p.user_pk} className={submitted ? "pulse-chip done" : "pulse-chip thinking"}>
              <div className="pulse-chip-avatar" style={PULSE_AVATAR_STYLES[idx % 4]}>
                {initials(p.display_name, p.username)}
              </div>
              <div className="pulse-chip-state">{submitted ? tr.reasonPulseSubmitted : tr.reasonPulseWriting}</div>
            </div>
          );
        })}
      </div>

      {isInsider && (
        <div
          style={{
            marginTop: "18px",
            padding: "12px 14px",
            background: "var(--purple-soft)",
            border: "1px solid rgba(167,139,250,0.3)",
            borderRadius: "var(--r-md)",
            fontSize: "12.5px",
            color: "var(--text-muted)",
            lineHeight: 1.6,
          }}
        >
          <strong style={{ color: "var(--purple)" }}>INSIDER: </strong>
          {tr.reasonInsiderHint}
        </div>
      )}
    </div>
  );
}
