import type { PostResponse } from "@ratel/ts-bridges";

// Helpers of app/ratel/src/features/social/pages/home/views/mod.rs.

// chrono `%b` (always English).
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function utcDate(timestampMs: number): Date | null {
  const d = new Date(timestampMs);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** `format_post_date`: `%b %-d, %Y` in UTC. */
export function formatPostDate(timestampMs: number): string {
  const d = utcDate(timestampMs);
  return d ? `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}` : "";
}

/** `format_since`: `%b %Y` in UTC, "—" for 0. */
export function formatSince(timestampMs: number): string {
  if (timestampMs === 0) return "—";
  const d = utcDate(timestampMs);
  return d ? `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` : "—";
}

/** Rust `String` ordering (byte-wise UTF-8 = code point order). */
function compareRustStrings(a: string, b: string): number {
  const ac = Array.from(a);
  const bc = Array.from(b);
  for (let i = 0; i < Math.min(ac.length, bc.length); i++) {
    const d = ac[i].codePointAt(0)! - bc[i].codePointAt(0)!;
    if (d !== 0) return d;
  }
  return ac.length - bc.length;
}

/** `derive_category_summary`: category → post count, in `BTreeMap` order. */
export function deriveCategorySummary(posts: PostResponse[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const p of posts) {
    for (const c of p.categories) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([a], [b]) => compareRustStrings(a, b));
}

/** `category_modifier`. */
export function categoryModifier(category: string | undefined): string {
  if (category === undefined) return "";
  const lower = category.toLowerCase();
  if (lower.includes("discuss") || lower.includes("dev")) return "post-card__cat--discuss";
  if (lower.includes("quiz") || lower.includes("update")) return "post-card__cat--quiz";
  if (lower.includes("reward") || lower.includes("governance")) return "post-card__cat--gold";
  if (lower.includes("community")) return "post-card__cat--teal";
  return "";
}
