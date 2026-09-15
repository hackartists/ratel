import { Fragment, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type {
  BetResponse,
  RationaleResponse,
  RoundParticipantSummary,
  RoundSubjectResponse,
  SettleRoundResponse,
  SettlementBreakdown,
} from "@ratel/ts-bridges";
import { displayName, monogram, withVariant } from "@/components/arcade/format";
import { ARCADE_HOME_PATH } from "@/components/arcade/paths";
import { useFactFoldRoomI18n } from "@/pages/arcade/games/fact-or-fold/rounds/[roundId]/i18n";
import { useUserContext } from "@/lib/auth";
import { dataBool } from "@/lib/dom";
import {
  useFactFoldRound,
  useRoundBets,
  useRoundParticipants,
  useRoundRationales,
  useRoundSettlement,
  useRoundSubject,
} from "../hooks/use-fact-fold-round";
import { activeSide } from "./round-format";

// app/ratel/src/features/arcade/games/fact_or_fold/pages/game_room/settlement/component.rs
// (`SettlementView`, Settled) — verdict banner, standings, the caller's
// settlement formula, the Essence opt-in and the exit button.

export function SettlementView() {
  const ctx = useFactFoldRound();
  const tr = useFactFoldRoomI18n();
  const subject = useRoundSubject(ctx.roundId);
  const settlement = useRoundSettlement(ctx.roundId);
  const participants = useRoundParticipants(ctx.roundId);
  const bets = useRoundBets(ctx.roundId);
  const rationales = useRoundRationales(ctx.roundId);
  const myPk = useUserContext().user?.id ?? "";
  const myRationale = rationales.items.find((r) => r.user_pk === myPk);

  return (
    <section className="view" data-active="true" data-view="result">
      <RevealBanner subject={subject} />

      {settlement ? (
        <>
          <div className="result-grid">
            <ResultTable settlement={settlement} bets={bets.items} participants={participants.items} myPk={myPk} />
            <div>
              <MySettlementCard settlement={settlement} myPk={myPk} />
              <EssenceCard myRationale={myRationale} />
            </div>
          </div>
          <SettlementExitRow />
        </>
      ) : (
        <div className="ff-room__placeholder">{tr.revealPending}</div>
      )}
    </section>
  );
}

function SettlementExitRow() {
  const tr = useFactFoldRoomI18n();
  const ctx = useFactFoldRound();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const onExit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    // Best effort: go home even if another player already wiped the transcript.
    await ctx.exitRound().catch(() => undefined);
    navigate(ARCADE_HOME_PATH);
  };

  return (
    <div className="settlement-exit-row">
      <button className="btn btn-primary" disabled={submitting} onClick={() => void onExit()}>
        {submitting ? tr.exitToHomeBusy : tr.exitToHomeLabel}
      </button>
    </div>
  );
}

function RevealBanner({ subject }: { subject: RoundSubjectResponse }) {
  const tr = useFactFoldRoomI18n();
  const [verdictLabel, verdictClass] =
    subject.verdict === "REAL"
      ? [tr.revealVerdictReal, "reveal-verdict real"]
      : subject.verdict === "FAKE"
        ? [tr.revealVerdictFake, "reveal-verdict fake"]
        : ["—", "reveal-verdict"];

  return (
    <div className="reveal-banner">
      <div className="reveal-label">{tr.revealBannerLabel}</div>
      <div className={verdictClass}>{verdictLabel}</div>
      <p className="reveal-subject">{subject.reveal_summary}</p>
      {subject.reveal_sources.length > 0 && (
        <div className="reveal-source">
          {`${tr.revealSourceLabel} `}
          {subject.reveal_sources.map((src, idx) => (
            <Fragment key={idx}>
              {idx > 0 && " · "}
              <a href={src.url}>{src.label}</a>
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

function ResultTable({
  settlement,
  bets,
  participants,
  myPk,
}: {
  settlement: SettleRoundResponse;
  bets: BetResponse[];
  participants: RoundParticipantSummary[];
  myPk: string;
}) {
  const tr = useFactFoldRoomI18n();
  return (
    <div className="result-table">
      <div className="section-head">
        <h2>{tr.resultTableTitle}</h2>
        <span className="sub">{tr.resultTableSub}</span>
      </div>
      {settlement.outcomes.map((row, idx) => (
        <ResultRow
          key={row.user_pk}
          idx={idx}
          row={row}
          participant={participants.find((p) => p.user_pk === row.user_pk)}
          bet={bets.find((b) => b.user_pk === row.user_pk)}
          isMe={row.user_pk === myPk}
        />
      ))}
    </div>
  );
}

function ResultRow({
  idx,
  row,
  participant,
  bet,
  isMe,
}: {
  idx: number;
  row: SettlementBreakdown;
  participant: RoundParticipantSummary | undefined;
  bet: BetResponse | undefined;
  isMe: boolean;
}) {
  const tr = useFactFoldRoomI18n();
  // Rust compares chips_out against a zero buy-in here (`round_buy_in = 0`).
  const delta = row.chips_out;
  const judgement = row.won
    ? row.insider_bonus > 0
      ? tr.resultJudgementInsiderWon
      : tr.resultJudgementWon
    : tr.resultJudgementLost;
  const side = bet ? activeSide(bet) : null;

  return (
    <div className="result-row">
      <div className={withVariant("p-avatar", idx)}>
        {participant ? monogram(participant.display_name || participant.username || "?") : ""}
      </div>
      <div className="result-meta">
        <div className="result-name">
          {participant ? displayName(participant) : row.user_pk}
          {isMe && (
            <span className="lb-you-badge" style={{ marginLeft: "6px" }}>
              YOU
            </span>
          )}
          {row.insider_bonus > 0 && (
            <span className="insider-truth-badge" style={{ marginLeft: "6px" }}>
              ⚐ INSIDER
            </span>
          )}
        </div>
        <div className="result-judgement">{judgement}</div>
      </div>
      <div className={side === "REAL" ? "result-bet-side real" : side === "FAKE" ? "result-bet-side fake" : "result-bet-side"}>
        {bet && side ? `${side} ${bet.amount_rp}` : "—"}
      </div>
      <div className={delta > 0 ? "result-delta up" : delta < 0 ? "result-delta down" : "result-delta"}>
        {delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : "±0"}
      </div>
    </div>
  );
}

function MySettlementCard({ settlement, myPk }: { settlement: SettleRoundResponse; myPk: string }) {
  const tr = useFactFoldRoomI18n();
  const mine = settlement.outcomes.find((o) => o.user_pk === myPk);
  if (!mine) return null;

  return (
    <div className="essence-card">
      <h3 className="card-title">{tr.mySettlementTitle}</h3>
      <FormulaRow label={tr.mySettleBase} value={mine.base_refund} />
      <FormulaRow label={tr.mySettleCorrect} value={mine.correct_bonus} />
      <FormulaRow label={tr.mySettlePool} value={mine.pool_share} />
      <FormulaRow label={tr.mySettleInfluence} value={mine.influence_bonus} />
      <FormulaRow label={tr.mySettleInsider} value={mine.insider_bonus} />
      <div className="formula-row total">
        <span className="lbl">{tr.mySettleTotal}</span>
        <span className="val">{`+${mine.chips_out} RP`}</span>
      </div>
    </div>
  );
}

function FormulaRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="formula-row">
      <span className="lbl">{label}</span>
      <span className="val">{value >= 0 ? `+${value} RP` : `${value} RP`}</span>
    </div>
  );
}

function EssenceCard({ myRationale }: { myRationale: RationaleResponse | undefined }) {
  const ctx = useFactFoldRound();
  const tr = useFactFoldRoomI18n();
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  if (!myRationale) return null;
  const alreadyRegistered = myRationale.essence_registered;
  const eligible = myRationale.essence_eligible;

  const onRegister = async () => {
    if (submittingRef.current || alreadyRegistered || !eligible) return;
    submittingRef.current = true;
    setSubmitting(true);
    await ctx.registerEssence().catch(() => undefined);
    submittingRef.current = false;
    setSubmitting(false);
  };

  return (
    <div className="essence-card" style={{ marginTop: "18px" }}>
      <div className="section-head">
        <h2>{tr.essenceTitle}</h2>
        <span className="sub">{tr.essenceSub}</span>
      </div>

      <div className="essence-list">
        <div className="essence-item">
          <div className="essence-checkbox" data-checked={dataBool(alreadyRegistered || eligible)}>
            {alreadyRegistered ? "✓" : ""}
          </div>
          <div>
            <div className="essence-meta">
              <span className="pill">{tr.essenceMyRationaleLabel}</span>
              {!eligible && <span className="pill pink">{tr.essenceIneligible}</span>}
            </div>
            <div className="essence-text">{myRationale.text}</div>
          </div>
        </div>
      </div>

      <div className="essence-foot">
        <span className="essence-foot-label" />
        <button
          className="btn btn-primary"
          disabled={submitting || alreadyRegistered || !eligible}
          onClick={() => void onRegister()}
        >
          {alreadyRegistered ? tr.essenceRegistered : tr.essenceRegister}
        </button>
      </div>
    </div>
  );
}
