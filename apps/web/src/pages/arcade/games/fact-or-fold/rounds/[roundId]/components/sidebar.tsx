import { useEffect, useState } from "react";
import type { RoundResponse } from "@ratel/ts-bridges";
import {
  useFactFoldRoomI18n,
  type FactFoldRoomI18n,
} from "@/pages/arcade/games/fact-or-fold/rounds/[roundId]/i18n";
import { nextStageName, stageIndex, stageName } from "./round-format";

// app/ratel/src/features/arcade/games/fact_or_fold/pages/game_room/component.rs
// — the sidebar: `StageTimeline` (stage_scroll.js centers its active step on
// mobile) and the live `TimerCard`.

export function StageTimeline({ round }: { round: RoundResponse }) {
  const tr = useFactFoldRoomI18n();
  const stages: [string, string][] = [
    [tr.stageNewsRevealName, tr.stageNewsRevealTime],
    [tr.stageBetName, tr.stageBetTime],
    [tr.stageRationaleName, tr.stageRationaleTime],
    [tr.stageRevealName, tr.stageRevealTime],
    [tr.stageDebateName, tr.stageDebateTime],
    [tr.stageSettlementName, tr.stageSettlementTime],
  ];
  const current = stageIndex(round.status);

  return (
    <div className="stage-timeline stage-timeline-global" id="globalTimeline">
      {stages.map(([name, time], idx) => {
        const state = current === null ? "upcoming" : idx < current ? "done" : idx === current ? "active" : "upcoming";
        return (
          <div key={idx} className="stage-step" data-state={state}>
            <div className="stage-dot">{state === "done" ? "✓" : idx + 1}</div>
            <div className="stage-label">
              <div className="stage-label-name">{name}</div>
              <div className="stage-label-time">{time}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function TimerCard({ round }: { round: RoundResponse }) {
  const tr = useFactFoldRoomI18n();

  // The round only refreshes every ~2.5s; re-render every second so the
  // countdown doesn't jump in chunks.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const { stageLabel, deadlineLabel, timeLabel, subLabel, fracRemaining } = computeTimer(round, tr);
  // Full circle is 377; offset by the fraction spent so the arc shrinks.
  const dashOffset = (377 * (1 - Math.min(Math.max(fracRemaining, 0), 1))).toFixed(1);

  return (
    <div className="timer-card">
      <div className="section-label">{tr.timerSectionLabel}</div>
      <div className="timer-stage">{stageLabel}</div>
      <div className="timer-deadline">{deadlineLabel}</div>
      <div className="timer-ring">
        <svg width={140} height={140} viewBox="0 0 140 140">
          <defs>
            <linearGradient id="timerGradSide" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fcb300" />
              <stop offset="100%" stopColor="#db2780" />
            </linearGradient>
          </defs>
          <circle cx={70} cy={70} r={60} className="timer-ring-bg" />
          <circle
            cx={70}
            cy={70}
            r={60}
            className="timer-ring-fg"
            strokeDasharray="377"
            strokeDashoffset={dashOffset}
            style={{ stroke: "url(#timerGradSide)" }}
          />
        </svg>
        <div className="timer-display">
          <div>
            <div className="timer-display-time">{timeLabel}</div>
            <div className="timer-display-sub">{subLabel}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface TimerState {
  stageLabel: string;
  deadlineLabel: string;
  timeLabel: string;
  subLabel: string;
  fracRemaining: number;
}

/** `compute_timer`. */
function computeTimer(round: RoundResponse, tr: FactFoldRoomI18n): TimerState {
  const stageLabel = stageName(round.status, tr);
  const nextLabel = nextStageName(round.status, tr);
  const now = Date.now();
  const started = round.stage_started_at ?? 0;
  const deadline = round.stage_deadline_at ?? 0;

  if (deadline === 0 || round.status === "Waiting") {
    return { stageLabel, deadlineLabel: "", timeLabel: "—", subLabel: tr.timerWaitingSub, fracRemaining: 0 };
  }
  if (round.status === "Settled") {
    return { stageLabel, deadlineLabel: "", timeLabel: "—", subLabel: tr.timerDoneSub, fracRemaining: 0 };
  }

  const remainingMs = Math.max(deadline - now, 0);
  const totalMs = Math.max(deadline - started, 1);
  const seconds = Math.ceil(remainingMs / 1000);
  return {
    stageLabel,
    deadlineLabel: nextLabel === "" ? "" : `${tr.timerNext} ${nextLabel}`,
    timeLabel: `${String(seconds).padStart(2, "0")}s`,
    subLabel: tr.timerRemainingSub,
    fracRemaining: remainingMs / totalMs,
  };
}
