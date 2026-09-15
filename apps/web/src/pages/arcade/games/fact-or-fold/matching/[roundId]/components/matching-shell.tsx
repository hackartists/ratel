import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { LobbyResponse } from "@ratel/ts-bridges";
import { fill, monogram, withVariant } from "@/components/arcade/format";
import { ARCADE_HOME_PATH } from "@/components/arcade/paths";
import { useFactFoldMatchingI18n } from "@/i18n/generated/features/arcade/games/fact_or_fold/pages/matching/fact-fold-matching.i18n";
import { useUserContext } from "@/lib/auth";
import { useLeaveLobby } from "../hooks/use-fact-fold-matching";

// app/ratel/src/features/arcade/games/fact_or_fold/pages/matching/component.rs
// — `MatchingShell` and its sections (buy-in note, seat slots, progress bar,
// hints, cancel row).

export function MatchingShell({ lobby }: { lobby: LobbyResponse }) {
  const tr = useFactFoldMatchingI18n();
  const { user } = useUserContext();
  const myPk = user?.id ?? "";
  const myDisplay = user ? user.display_name || user.username : "you";

  const round = lobby.current_round;
  const capacity = Math.max(lobby.round_capacity, 1);
  const participants = round?.participant_pks ?? [];
  const ready = round !== null && round.status !== "Waiting";

  const eyebrowLabel = ready
    ? tr.eyebrowFull
    : round
      ? fill(tr.eyebrowWaiting, { capacity })
      : tr.eyebrowNoRound;

  return (
    <>
      <div className="matching-eyebrow">
        <span className="matching-eyebrow-dot" />
        <span>{eyebrowLabel}</span>
      </div>

      <h1 className="matching-title">{tr.title}</h1>
      <p className="matching-subtitle">{tr.subtitle}</p>

      <div className="matching-buyin-note">{fill(tr.buyinNote, { chips: lobby.buy_in_chips })}</div>

      <div className="matching-slots">
        {Array.from({ length: capacity }, (_, idx) => {
          const pk = participants[idx];
          const seatLabel = fill(tr.slotSeat, { n: idx + 1 });
          if (pk === undefined) return <EmptySlot key={`seat-${idx}`} seatLabel={seatLabel} />;
          const isMe = pk === myPk;
          return (
            <FilledSlot
              key={`seat-${idx}`}
              idx={idx}
              seatLabel={seatLabel}
              display={isMe ? myDisplay : shortDisplay(pk)}
              isMe={isMe}
            />
          );
        })}
      </div>

      <ProgressBar current={participants.length} capacity={capacity} />
      <HintsStrip />
      <CancelRow />
    </>
  );
}

function FilledSlot({ idx, seatLabel, display, isMe }: { idx: number; seatLabel: string; display: string; isMe: boolean }) {
  const tr = useFactFoldMatchingI18n();
  return (
    <div
      className="matching-slot"
      data-testid={isMe ? "ff-matching-slot-self" : `ff-matching-slot-${idx}`}
      data-state={isMe ? "me" : "filled"}
    >
      <div className="matching-slot-num">{seatLabel}</div>
      <div className={withVariant("matching-slot-avatar", idx)}>{display === "" ? "?" : monogram(display)}</div>
      <div className="matching-slot-name">
        {display}
        {isMe && <span className="you-tag">{tr.youTag}</span>}
      </div>
      <div className="matching-slot-pill">{tr.slotPillReady}</div>
    </div>
  );
}

function EmptySlot({ seatLabel }: { seatLabel: string }) {
  const tr = useFactFoldMatchingI18n();
  return (
    <div className="matching-slot" data-state="empty">
      <div className="matching-slot-num">{seatLabel}</div>
      <div className="matching-slot-avatar">··</div>
      <div className="matching-slot-placeholder">{tr.slotEmpty}</div>
      <div className="matching-slot-pill">{tr.slotPillEmpty}</div>
    </div>
  );
}

function ProgressBar({ current, capacity }: { current: number; capacity: number }) {
  const tr = useFactFoldMatchingI18n();
  // `((current / capacity) * 100.0).clamp(0, 100) as i32` — truncates.
  const pct = capacity === 0 ? 0 : Math.trunc(Math.min(Math.max((current / capacity) * 100, 0), 100));

  return (
    <div className="matching-progress">
      <div className="matching-progress-head">
        <span>{tr.progressLabel}</span>
        <span className="matching-progress-count">{fill(tr.progressCount, { current, capacity })}</span>
      </div>
      <div className="matching-progress-bar">
        <div className="matching-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function HintsStrip() {
  const tr = useFactFoldMatchingI18n();
  return (
    <div className="matching-hints">
      <div className="matching-hint">
        <span className="matching-hint-icon">◇</span>
        <span>
          <strong>{tr.hintTimingStrong}</strong>
          {tr.hintTimingBody}
        </span>
      </div>
      <div className="matching-hint">
        <span className="matching-hint-icon">⚐</span>
        <span>
          <strong>{tr.hintInsiderStrong}</strong>
          {tr.hintInsiderBody}
        </span>
      </div>
      <div className="matching-hint">
        <span className="matching-hint-icon">◆</span>
        <span>
          <strong>{tr.hintPersuadeStrong}</strong>
          {tr.hintPersuadeBody}
        </span>
      </div>
    </div>
  );
}

function CancelRow() {
  const tr = useFactFoldMatchingI18n();
  const leave = useLeaveLobby();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const onCancel = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await leave();
      navigate(ARCADE_HOME_PATH);
    } catch {
      setError(tr.leaveError);
    }
    submittingRef.current = false;
    setSubmitting(false);
  };

  return (
    <>
      <div className="matching-actions">
        <button
          className="btn btn-ghost"
          data-testid="ff-matching-cancel"
          style={{ padding: "10px 18px", fontSize: "13px" }}
          disabled={submitting}
          onClick={() => void onCancel()}
        >
          {tr.cancelBtn}
        </button>
        <span className="matching-actions-hint">{tr.cancelHint}</span>
      </div>
      {error !== null && (
        <div className="reason-warn" style={{ marginTop: "10px", maxWidth: "520px" }}>
          {error}
        </div>
      )}
    </>
  );
}

/** `short_display` — the lobby only carries pks, so other seats show a pk prefix. */
function shortDisplay(pk: string): string {
  const stripped = pk.startsWith("USER#") ? pk.slice("USER#".length) : pk;
  return Array.from(stripped).slice(0, 6).join("").toLowerCase();
}
