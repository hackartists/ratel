import { useRef, useState } from "react";
import type { BetResponse, BetSide } from "@ratel/ts-bridges";
import { useFactFoldRoomI18n } from "@/pages/arcade/games/fact-or-fold/rounds/[roundId]/i18n";
import { useUserContext } from "@/lib/auth";
import { dataBool } from "@/lib/dom";
import { useFactFoldRound, useRoundBets, useRoundInsider } from "../hooks/use-fact-fold-round";

// app/ratel/src/features/arcade/games/fact_or_fold/pages/game_room/first_bet/component.rs
// (`FirstBetView`, stage 2) — REAL/FAKE + RP slider, the insider card for the
// insider, and a locked confirmation once the caller's bet is in.

const DEFAULT_BET_RP = 300;
const MIN_BET_RP = 100;
const MAX_BET_RP = 1_000;
const BET_STEP_RP = 50;

export function FirstBetView() {
  const ctx = useFactFoldRound();
  const bets = useRoundBets(ctx.roundId);
  const insider = useRoundInsider(ctx.roundId);
  const myPk = useUserContext().user?.id ?? "";
  const myBet = bets.items.find((b) => b.user_pk === myPk);

  return (
    <section className="view" data-active="true" data-view="bet">
      <div className="live-bet-grid">
        <div>
          {insider.statement !== null && <InsiderCard statement={insider.statement} />}
          {myBet ? (
            <BetLockedCard bet={myBet} />
          ) : (
            <BetForm onSubmit={(side, amount) => void ctx.placeBet(side, amount).catch(() => undefined)} />
          )}
        </div>
      </div>
    </section>
  );
}

function InsiderCard({ statement }: { statement: string }) {
  const tr = useFactFoldRoomI18n();
  return (
    <div className="insider-card" style={{ marginBottom: "18px" }}>
      <div className="insider-head">
        <div className="insider-icon">⚐</div>
        <div className="insider-title">{tr.insiderTitle}</div>
      </div>
      <div className="insider-body">{statement}</div>
      <div className="insider-foot">{tr.insiderTip}</div>
    </div>
  );
}

function BetForm({ onSubmit }: { onSubmit: (side: BetSide, amount: number) => void }) {
  const tr = useFactFoldRoomI18n();
  const [side, setSide] = useState<BetSide>("REAL");
  const [amount, setAmount] = useState(DEFAULT_BET_RP);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const onSlider = (raw: string) => {
    if (!/^[+-]?\d+$/.test(raw)) return;
    setAmount(Math.min(Math.max(Number(raw), MIN_BET_RP), MAX_BET_RP));
  };

  const onConfirm = () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    onSubmit(side, amount);
    submittingRef.current = false;
    setSubmitting(false);
  };

  return (
    <div className="bet-card">
      <h3 className="card-title">{tr.betCardTitle}</h3>
      <p className="card-sub">{tr.betCardSub}</p>

      <div className="bet-toggle">
        <div className="bet-option" data-side="real" data-selected={dataBool(side === "REAL")} onClick={() => setSide("REAL")}>
          <div className="bet-option-icon">◎</div>
          <div className="bet-option-label">{tr.betOptionRealLabel}</div>
          <div className="bet-option-sub">{tr.betOptionRealSub}</div>
        </div>
        <div className="bet-option" data-side="fake" data-selected={dataBool(side === "FAKE")} onClick={() => setSide("FAKE")}>
          <div className="bet-option-icon">⊘</div>
          <div className="bet-option-label">{tr.betOptionFakeLabel}</div>
          <div className="bet-option-sub">{tr.betOptionFakeSub}</div>
        </div>
      </div>

      <div className="rp-slider-wrap">
        <div className="rp-slider-head">
          <span className="rp-slider-label">{tr.betSliderLabel}</span>
          <span className="rp-slider-value">{`${amount} RP`}</span>
        </div>
        <input
          type="range"
          className="rp-slider"
          min={String(MIN_BET_RP)}
          max={String(MAX_BET_RP)}
          step={String(BET_STEP_RP)}
          value={String(amount)}
          onChange={(e) => onSlider(e.target.value)}
        />
        <div className="rp-slider-ticks">
          <span>100</span>
          <span>300</span>
          <span>500</span>
          <span>700</span>
          <span>1000</span>
        </div>
      </div>

      <div className="submit-row">
        <button className="btn btn-primary" disabled={submitting} onClick={onConfirm}>
          {tr.betSubmit}
        </button>
        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{tr.betSubmitHint}</span>
      </div>
    </div>
  );
}

function BetLockedCard({ bet }: { bet: BetResponse }) {
  const tr = useFactFoldRoomI18n();
  return (
    <div className="bet-card">
      <h3 className="card-title">{tr.betAlreadyPlacedTitle}</h3>
      <p className="card-sub">{tr.betAlreadyPlacedBody}</p>
      <div className="submit-row">
        <span className={bet.side === "REAL" ? "pill gold" : "pill pink"}>{bet.side}</span>
        <span className="rp-slider-value">{`${bet.amount_rp} RP`}</span>
      </div>
    </div>
  );
}
