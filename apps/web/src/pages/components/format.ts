// Formatting helpers of app/ratel/src/views/index/component.rs (lines 893-1022, 1180-1186).
// Strings the Rust file hardcodes outside `translate!` stay English constants here.
import type { HotSpaceHeat, HotSpaceResponse } from "@ratel/ts-bridges";
import { currentEnvironment, Environment } from "@/lib/environment";

/** component.rs:121 */
export const BRAND_LOGO = "https://metadata.ratel.foundation/logos/logo-symbol.png";

/** `HeatLevel::css()` / `heat_css_name` (space_card/component.rs:11-17, component.rs:901-907). */
export type HeatCss = "blazing" | "trending" | "rising";
export function heatCss(heat: HotSpaceHeat): HeatCss {
  return heat === "Blazing" ? "blazing" : heat === "Trending" ? "trending" : "rising";
}

export type ChipKind = "action-chip--poll" | "action-chip--discuss" | "action-chip--quiz" | "action-chip--follow";
export interface ActionChip {
  kind: ChipKind;
  label: string;
}

/** component.rs:909-915 */
export function cardTitle(card: HotSpaceResponse): string {
  return card.title === "" ? "Untitled Space" : card.title;
}

/** component.rs:917-923 */
export function cardLogo(card: HotSpaceResponse): string {
  return card.logo === "" ? BRAND_LOGO : card.logo;
}

/** component.rs:925-931 */
export function cardCategory(card: HotSpaceResponse): string {
  return card.author_display_name === "" ? "Space" : card.author_display_name;
}

/** component.rs:962-968 */
function plural(n: number, singular: string, pluralForm: string): string {
  return n === 1 ? `${n} ${singular}` : `${n} ${pluralForm}`;
}

/** component.rs:933-960 */
export function chipsFor(card: HotSpaceResponse): ActionChip[] {
  const chips: ActionChip[] = [];
  if (card.poll_count > 0) chips.push({ kind: "action-chip--poll", label: plural(card.poll_count, "Poll", "Polls") });
  if (card.discussion_count > 0)
    chips.push({ kind: "action-chip--discuss", label: plural(card.discussion_count, "Discussion", "Discussions") });
  if (card.quiz_count > 0) chips.push({ kind: "action-chip--quiz", label: plural(card.quiz_count, "Quiz", "Quizzes") });
  if (card.follow_count > 0)
    chips.push({ kind: "action-chip--follow", label: plural(card.follow_count, "Follow Quest", "Follow Quests") });
  return chips;
}

/**
 * Rust `format!("{:.1}", x)`: like `toFixed(1)` on the same double, except an
 * exact tie (x.25, x.75) rounds half to even instead of up.
 */
function rustFixed1(x: number): string {
  const tenths = x * 10;
  if (Number.isInteger(x * 20) && !Number.isInteger(tenths)) {
    const down = Math.floor(tenths);
    const even = down % 2 === 0 ? down : down + 1;
    return (even / 10).toFixed(1);
  }
  return x.toFixed(1);
}

/** component.rs:970-978 */
export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${rustFixed1(n / 1_000_000)}M`;
  if (n >= 1_000) return `${rustFixed1(n / 1_000)}k`;
  return String(n);
}

/** component.rs:980-994 */
export function formatThousands(n: number): string {
  const s = String(Math.abs(n));
  let out = "";
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ",";
    out += s[i];
  }
  return n < 0 ? `-${out}` : out;
}

/** component.rs:996-1002 */
export function heatLabel(totalActions: number): string {
  return totalActions === 0 ? "—" : `${totalActions} quests`;
}

/** component.rs:1004-1010 */
export function balanceText(hasUser: boolean): string {
  return hasUser ? "—" : "0";
}

/** `format!("#{:02}", rank)` (space_card/component.rs:75). */
export function rankText(rank: number): string {
  return `#${String(rank).padStart(2, "0")}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** component.rs:1180-1186 — chrono `"%b %-d. %Y"` in UTC. */
export function formatPostDate(timestampMs: number): string {
  const d = new Date(timestampMs);
  if (Number.isNaN(d.getTime())) return "";
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}. ${d.getUTCFullYear()}`;
}

/** component.rs:1016-1022 — Arcade is pre-release: only local and dev builds show it. */
export function isArcadeVisibleEnv(): boolean {
  const env = currentEnvironment();
  return env === Environment.Local || env === Environment.Dev;
}

/** `FeedPartition` from a `Partition` string (`FEED#<id>` → `<id>`), as `resp.post_pk.into()`. */
export function partitionId(pk: string): string {
  const i = pk.indexOf("#");
  return i >= 0 ? pk.slice(i + 1) : pk;
}
