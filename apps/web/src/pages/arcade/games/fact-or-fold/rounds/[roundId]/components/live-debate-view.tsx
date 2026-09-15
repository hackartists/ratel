import { useState, type FormEvent } from "react";
import type { BetResponse, ChatMessagePayload, RoundParticipantSummary, RoundResponse } from "@ratel/ts-bridges";
import { monogram } from "@/components/arcade/format";
import { useFactFoldRoomI18n } from "@/pages/arcade/games/fact-or-fold/rounds/[roundId]/i18n";
import { useUserContext } from "@/lib/auth";
import { useFactFoldRound, useRound, useRoundBets, useRoundParticipants } from "../hooks/use-fact-fold-round";
import { CHAT_TEXT_MAX_CHARS, FLIP_SLOT_LAST_MS } from "./round-format";

// app/ratel/src/features/arcade/games/fact_or_fold/pages/game_room/live_debate/component.rs
// (`LiveDebateView`, stage 5) — polled chat + the final-bet flip bar that
// opens in the last `FLIP_SLOT_LAST_MS` of the stage.

export function LiveDebateView() {
  const ctx = useFactFoldRound();
  const round = useRound(ctx.roundId);
  const bets = useRoundBets(ctx.roundId);
  const participants = useRoundParticipants(ctx.roundId);
  const myPk = useUserContext().user?.id ?? "";
  const myBet = bets.items.find((b) => b.user_pk === myPk);

  return (
    <section className="view" data-active="true" data-view="debate">
      <ChatPanel
        messages={ctx.chat}
        myPk={myPk}
        participants={participants.items}
        debateStartedAt={round.stage_started_at ?? 0}
        onPost={(text) => void ctx.postChat(text).catch(() => undefined)}
      />
      <FinalBetBar round={round} myBet={myBet} />
    </section>
  );
}

function ChatPanel({
  messages,
  myPk,
  participants,
  debateStartedAt,
  onPost,
}: {
  messages: ChatMessagePayload[];
  myPk: string;
  participants: RoundParticipantSummary[];
  debateStartedAt: number;
  onPost: (text: string) => void;
}) {
  const tr = useFactFoldRoomI18n();
  const [draft, setDraft] = useState("");

  // <form onSubmit> fires after an in-flight IME composition commits.
  const onSubmit = (evt: FormEvent<HTMLFormElement>) => {
    evt.preventDefault();
    const body = draft.trim();
    if (body === "") return;
    setDraft("");
    onPost(body);
  };

  return (
    <div className="live-chat-card">
      <div className="section-head">
        <h2>{tr.chatTitle}</h2>
        <span className="sub">{tr.chatSub}</span>
      </div>

      <div className="live-chat-list">
        {messages.length === 0 && <div className="ff-room__placeholder">{tr.chatEmpty}</div>}
        {messages.map((msg) => (
          <div key={msg.msg_id} className="chat-msg">
            <span className={msg.author_pk === myPk ? "chat-msg-author me" : "chat-msg-author"}>
              {participantDisplay(msg.author_pk, participants)}
            </span>
            <span className="chat-msg-time">{formatRelativeTime(msg.sent_at, debateStartedAt)}</span>
            <span className="chat-msg-body">{msg.text}</span>
          </div>
        ))}
      </div>

      <form className="chat-input-row" onSubmit={onSubmit}>
        <input
          type="text"
          className="chat-input"
          placeholder={tr.chatPlaceholder}
          maxLength={CHAT_TEXT_MAX_CHARS}
          value={draft}
          onChange={(e) => setDraft(Array.from(e.target.value).slice(0, CHAT_TEXT_MAX_CHARS).join(""))}
        />
        <button type="submit" className="btn btn-ghost" style={{ padding: "9px 14px", fontSize: "12.5px" }}>
          {tr.chatSend}
        </button>
      </form>
    </div>
  );
}

function FinalBetBar({ round, myBet }: { round: RoundResponse; myBet: BetResponse | undefined }) {
  const tr = useFactFoldRoomI18n();
  const ctx = useFactFoldRound();
  const remainingMs = Math.max((round.stage_deadline_at ?? 0) - Date.now(), 0);

  const flipOpen = remainingMs <= FLIP_SLOT_LAST_MS && remainingMs > 0;
  const alreadyFlipped = myBet?.flipped_to != null;
  const cite = ctx.citedUserPk;
  const hasCite = cite !== null;

  const bodyText = alreadyFlipped
    ? tr.finalAlreadyFlipped
    : !flipOpen
      ? tr.finalTextLocked
      : !hasCite
        ? tr.finalTextOpenNoCite
        : tr.finalTextOpenReady;

  const onFlip = () => {
    if (!myBet || cite === null) return;
    void ctx.flipBet(myBet.side === "REAL" ? "FAKE" : "REAL", cite).catch(() => undefined);
  };
  // Keep needs no server call: the slot defaults to "keep" at the deadline.
  const onKeep = () => undefined;

  return (
    <div className={flipOpen ? "final-bet-bar" : "final-bet-bar hidden"}>
      <div className="final-bet-tag">{tr.finalTag}</div>
      <div className="final-bet-text">{bodyText}</div>
      <button className="mini-btn" disabled={!flipOpen || alreadyFlipped} onClick={onKeep}>
        {tr.finalBtnKeep}
      </button>
      <button className="mini-btn pink" disabled={!flipOpen || alreadyFlipped || !hasCite || !myBet} onClick={onFlip}>
        {tr.finalBtnFlip}
      </button>
      <div className="final-bet-countdown">{remainingMs === 0 ? "—" : `−${Math.ceil(remainingMs / 1000)}s`}</div>
    </div>
  );
}

/** `participant_display` — the author's two-letter monogram. */
function participantDisplay(pk: string, participants: RoundParticipantSummary[]): string {
  const p = participants.find((x) => x.user_pk === pk);
  if (!p) return Array.from(pk).slice(0, 2).join("").toUpperCase();
  return monogram(p.display_name || p.username || pk);
}

/** `format_relative_time` — `MM:SS` since the debate started, capped at 99:59. */
function formatRelativeTime(sentAt: number, debateStartedAt: number): string {
  if (debateStartedAt === 0) return "--:--";
  const secs = Math.min(Math.max(Math.trunc((sentAt - debateStartedAt) / 1000), 0), 99 * 60 + 59);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(secs / 60))}:${pad(secs % 60)}`;
}
