import { useQueries, useQueryClient, useSuspenseQuery, type QueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  deleteRoundChatHandler,
  flipBetHandler,
  getInsiderStatementHandler,
  getRoundHandler,
  getRoundSettlementHandler,
  getRoundSubjectHandler,
  heartbeatHandler,
  listChatHandler,
  listRoundBetsHandler,
  listRoundParticipantsHandler,
  listRoundRationalesHandler,
  placeBetHandler,
  postChatHandler,
  registerEssenceHandler,
  submitRationaleHandler,
  tickHandler,
} from "@ratel/ts-bridges";
import type {
  BetResponse,
  BetSide,
  ChatMessagePayload,
  InsiderStatementResponse,
  ListBetsResponse,
  ListParticipantsResponse,
  ListRationalesResponse,
  RoundResponse,
  RoundSubjectResponse,
  SettleRoundResponse,
} from "@ratel/ts-bridges";

// app/ratel/src/features/arcade/games/fact_or_fold/hooks/use_round.rs
// (`UseFactFoldRound`) — the game-room controller, plus the page's polling and
// heartbeat loops (game_room/component.rs).
//
// Transport: the Rust client polls; it never opens the `/api/arcade/events`
// SSE stream (nothing under app/ratel/src subscribes to it), so neither does
// this port. Every ~2.5s the loop ticks the stage once the wall clock passes
// `stage_deadline_at`, refetches every round-scoped query and pulls chat
// deltas (`?since=<last_id>`); a separate 30s loop sends heartbeats.
//
// Loaders: each Rust `ctx.xxx()?` becomes a suspense query keyed by round id;
// the per-loader refresh counters become invalidations.

const POLL_INTERVAL_MS = 2_500;
const HEARTBEAT_INTERVAL_MS = 30_000;

const keys = {
  round: (id: string) => ["getRound", id] as const,
  subject: (id: string) => ["getRoundSubject", id] as const,
  participants: (id: string) => ["listRoundParticipants", id] as const,
  bets: (id: string) => ["listRoundBets", id] as const,
  rationales: (id: string) => ["listRoundRationales", id] as const,
  insider: (id: string) => ["getInsiderStatement", id] as const,
  // Not the scaffolded key: this entry holds `SettleRoundResponse | null`.
  settlement: (id: string) => ["getRoundSettlement", id, "optional"] as const,
};

export interface FactFoldRound {
  roundId: string;
  /** Chronological chat log; appended by `pollChat` / `postChat`. */
  chat: ChatMessagePayload[];
  /** The player marked "decisive" in the reveal stage; cited by the flip. */
  citedUserPk: string | null;
  setCitedUserPk: (pk: string | null) => void;
  placeBet: (side: BetSide, amountRp: number) => Promise<BetResponse>;
  submitRationale: (text: string) => Promise<void>;
  registerEssence: () => Promise<void>;
  flipBet: (side: BetSide, citeUserPk: string) => Promise<void>;
  postChat: (text: string) => Promise<void>;
  exitRound: () => Promise<void>;
}

const FactFoldRoundContext = createContext<FactFoldRound | null>(null);
export const FactFoldRoundProvider = FactFoldRoundContext.Provider;

/** `use_fact_fold_round()`. */
export function useFactFoldRound(): FactFoldRound {
  const ctx = useContext(FactFoldRoundContext);
  if (!ctx) throw new Error("useFactFoldRound must be used under FactFoldRoundProvider");
  return ctx;
}

// ── Loaders ─────────────────────────────────────────────────────────

const queries = {
  round: (id: string) => ({ queryKey: keys.round(id), queryFn: () => getRoundHandler(id) }),
  subject: (id: string) => ({ queryKey: keys.subject(id), queryFn: () => getRoundSubjectHandler(id) }),
  participants: (id: string) => ({ queryKey: keys.participants(id), queryFn: () => listRoundParticipantsHandler(id) }),
  bets: (id: string) => ({ queryKey: keys.bets(id), queryFn: () => listRoundBetsHandler(id) }),
  rationales: (id: string) => ({ queryKey: keys.rationales(id), queryFn: () => listRoundRationalesHandler(id) }),
  insider: (id: string) => ({ queryKey: keys.insider(id), queryFn: () => getInsiderStatementHandler(id) }),
  // Settlement answers 409 `RoundNotSettled` until the round wraps up; any failure reads as "not ready".
  settlement: (id: string) => ({
    queryKey: keys.settlement(id),
    queryFn: (): Promise<SettleRoundResponse | null> => getRoundSettlementHandler(id).catch(() => null),
  }),
};

export function useRound(roundId: string): RoundResponse {
  return useSuspenseQuery(queries.round(roundId)).data;
}

export function useRoundSubject(roundId: string): RoundSubjectResponse {
  return useSuspenseQuery(queries.subject(roundId)).data;
}

export function useRoundParticipants(roundId: string): ListParticipantsResponse {
  return useSuspenseQuery(queries.participants(roundId)).data;
}

export function useRoundBets(roundId: string): ListBetsResponse {
  return useSuspenseQuery(queries.bets(roundId)).data;
}

export function useRoundRationales(roundId: string): ListRationalesResponse {
  return useSuspenseQuery(queries.rationales(roundId)).data;
}

export function useRoundInsider(roundId: string): InsiderStatementResponse {
  return useSuspenseQuery(queries.insider(roundId)).data;
}

export function useRoundSettlement(roundId: string): SettleRoundResponse | null {
  return useSuspenseQuery(queries.settlement(roundId)).data;
}

/** `refresh_all()` — chat is excluded (incremental, not replace-all). */
function refreshAll(queryClient: QueryClient, roundId: string): Promise<unknown> {
  return Promise.all(
    [keys.round, keys.subject, keys.participants, keys.bets, keys.rationales, keys.insider, keys.settlement].map((key) =>
      queryClient.invalidateQueries({ queryKey: key(roundId) }),
    ),
  );
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// ── Controller ──────────────────────────────────────────────────────

/** `use_fact_fold_round_provider(round_id)` plus the page's polling + heartbeat loops. */
export function useFactFoldRoundProvider(roundId: string): FactFoldRound {
  const queryClient = useQueryClient();
  // Warm every stage's loaders without suspending. Each stage view suspends
  // on its own queries; a first fetch at a stage change would suspend the
  // root boundary, which hides the whole arcade layout (and leaves a
  // `style=""` behind on it). Failures stay in the cache for the view to hit.
  useQueries({
    queries: [
      queries.subject(roundId),
      queries.participants(roundId),
      queries.bets(roundId),
      queries.rationales(roundId),
      queries.insider(roundId),
      queries.settlement(roundId),
    ],
  });
  const [chat, setChat] = useState<ChatMessagePayload[]>([]);
  const [citedUserPk, setCitedUserPk] = useState<string | null>(null);
  const lastChatId = useRef<string | null>(null);

  const actions = useMemo(() => {
    const appendChat = (items: ChatMessagePayload[]) =>
      setChat((buf) => {
        const next = [...buf];
        for (const m of items) if (!next.some((existing) => existing.msg_id === m.msg_id)) next.push(m);
        return next.length === buf.length ? buf : next;
      });

    return {
      tick: async () => {
        await tickHandler(roundId);
        void refreshAll(queryClient, roundId);
      },
      heartbeat: async () => {
        await heartbeatHandler(roundId);
      },
      pollChat: async () => {
        const res = await listChatHandler(roundId, lastChatId.current);
        if (res.items.length === 0) return;
        appendChat(res.items);
        if (res.last_id !== null) lastChatId.current = res.last_id;
      },
      placeBet: async (side: BetSide, amountRp: number) => {
        const res = await placeBetHandler(roundId, { side, amount_rp: amountRp });
        void queryClient.invalidateQueries({ queryKey: keys.bets(roundId) });
        return res;
      },
      submitRationale: async (text: string) => {
        await submitRationaleHandler(roundId, { text });
        void queryClient.invalidateQueries({ queryKey: keys.rationales(roundId) });
      },
      registerEssence: async () => {
        await registerEssenceHandler(roundId, { register: true });
        void queryClient.invalidateQueries({ queryKey: keys.rationales(roundId) });
      },
      flipBet: async (side: BetSide, citeUserPk: string) => {
        await flipBetHandler(roundId, { side, cite_user_pk: citeUserPk });
        void queryClient.invalidateQueries({ queryKey: keys.bets(roundId) });
      },
      postChat: async (text: string) => {
        const res = await postChatHandler(roundId, { text });
        // Optimistic append; the next poll dedups by msg_id and moves the cursor.
        appendChat([{ msg_id: res.msg_id, author_pk: res.author_pk, text: res.text, sent_at: res.sent_at }]);
      },
      exitRound: async () => {
        await deleteRoundChatHandler(roundId);
        setChat([]);
        lastChatId.current = null;
      },
    };
  }, [queryClient, roundId]);

  // Polling loop (game_room/component.rs): sleep, tick past the deadline,
  // refresh every loader, pull chat deltas.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      while (!cancelled) {
        await sleep(POLL_INTERVAL_MS);
        if (cancelled) break;
        const round = queryClient.getQueryData<RoundResponse>(keys.round(roundId));
        if (round) {
          const pastDeadline = round.stage_deadline_at !== null && Date.now() >= round.stage_deadline_at;
          const active = round.status !== "Waiting" && round.status !== "Settled";
          if (active && pastDeadline) await actions.tick().catch(() => undefined);
        }
        if (cancelled) break;
        // Like a Dioxus loader restart, a refetch re-renders consumers only
        // when the data actually changed (structural sharing ≈ PartialEq).
        // Time-derived UI such as the flip slot therefore updates on the
        // next data change, not on a clock — same as the Rust views.
        void refreshAll(queryClient, roundId);
        await actions.pollChat().catch(() => undefined);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [actions, queryClient, roundId]);

  // Heartbeat loop — its own cadence so the endpoint isn't hit on every poll.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      while (!cancelled) {
        await sleep(HEARTBEAT_INTERVAL_MS);
        if (cancelled) break;
        await actions.heartbeat().catch(() => undefined);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [actions]);

  return {
    roundId,
    chat,
    citedUserPk,
    setCitedUserPk,
    placeBet: actions.placeBet,
    submitRationale: actions.submitRationale,
    registerEssence: actions.registerEssence,
    flipBet: actions.flipBet,
    postChat: actions.postChat,
    exitRound: actions.exitRound,
  };
}
