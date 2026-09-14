import type { BetResponse, BetSide, RoundStatus } from "@ratel/ts-bridges";
import type { FactFoldRoomI18n } from "@/i18n/generated/features/arcade/games/fact_or_fold/pages/game_room/fact-fold-room.i18n";

// Helpers shared by the game-room stage views (game_room/**/*.rs).

/** `RATIONALE_TEXT_MAX_CHARS` (fact_or_fold/types/dto.rs). */
export const RATIONALE_TEXT_MAX_CHARS = 200;
/** `CHAT_TEXT_MAX_CHARS`. */
export const CHAT_TEXT_MAX_CHARS = 80;
/** `FLIP_SLOT_LAST_MS`. */
export const FLIP_SLOT_LAST_MS = 10_000;

/** `render_difficulty` — `★★★☆☆`, `?` outside 1..=5. */
export function renderDifficulty(d: number): string {
  if (!(d >= 1 && d <= 5)) return "?";
  return "★".repeat(d) + "☆".repeat(5 - d);
}

/** Rust `str.chars().count()`. */
export function charCount(s: string): number {
  return Array.from(s).length;
}

/** `bet.flipped_to.unwrap_or(bet.side)`. */
export function activeSide(bet: BetResponse): BetSide {
  return bet.flipped_to ?? bet.side;
}

/** `match side { Real => "REAL", Fake => "FAKE" }` — the wire value. */
export function sideLabel(side: BetSide): "REAL" | "FAKE" {
  return side;
}

/** `stage_index` — position on the 6-step timeline; `Waiting` isn't on it. */
export function stageIndex(s: RoundStatus): number | null {
  switch (s) {
    case "NewsReveal":
      return 0;
    case "Bet":
      return 1;
    case "Rationale":
      return 2;
    case "Reveal":
      return 3;
    case "Debate":
      return 4;
    case "Settlement":
    case "Settled":
      return 5;
    case "Waiting":
      return null;
  }
}

export function stageName(s: RoundStatus, tr: FactFoldRoomI18n): string {
  switch (s) {
    case "Waiting":
    case "NewsReveal":
      return tr.stageNewsRevealName;
    case "Bet":
      return tr.stageBetName;
    case "Rationale":
      return tr.stageRationaleName;
    case "Reveal":
      return tr.stageRevealName;
    case "Debate":
      return tr.stageDebateName;
    case "Settlement":
    case "Settled":
      return tr.stageSettlementName;
  }
}

export function nextStageName(s: RoundStatus, tr: FactFoldRoomI18n): string {
  switch (s) {
    case "NewsReveal":
      return tr.stageBetName;
    case "Bet":
      return tr.stageRationaleName;
    case "Rationale":
      return tr.stageRevealName;
    case "Reveal":
      return tr.stageDebateName;
    case "Debate":
      return tr.stageSettlementName;
    default:
      return "";
  }
}
