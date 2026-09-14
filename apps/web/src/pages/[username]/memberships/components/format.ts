// Formatting helpers shared by the user and team membership views.

/** Rust `i64::MAX` — JSON parses it to 2^63, which this literal also rounds to. */
export const I64_MAX = 9223372036854775807;

const pad = (n: number, width: number) => String(n).padStart(width, "0");

/** chrono `%Y-%m-%d` / `%Y · %m · %d` in UTC, or `null` for an out-of-range timestamp. */
function utcParts(ms: number): [string, string, string] | null {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  // chrono pads `%Y` to 4 digits and adds an explicit sign outside 0..=9999.
  const year = y > 9999 ? `+${y}` : y < 0 ? `-${pad(-y, 4)}` : pad(y, 4);
  return [year, pad(d.getUTCMonth() + 1, 2), pad(d.getUTCDate(), 2)];
}

/** user/components/purchase_history.rs:201 `format_date`. */
export function formatDate(timestamp: number, unlimitedLabel: string): string {
  if (timestamp === I64_MAX) return unlimitedLabel;
  const parts = utcParts(timestamp);
  return parts ? parts.join("-") : String(timestamp);
}

/** user/components/purchase_history.rs:214 `format_membership_tier_label`. */
export function formatMembershipTierLabel(tier: string, enterpriseLabel: string): string {
  const stripped = tier.startsWith("MEMBERSHIP#") ? tier.slice("MEMBERSHIP#".length) : tier;
  return stripped.startsWith("ENTERPRISE#") ? enterpriseLabel : stripped;
}

/** team/views/mod.rs:771 `format_expiry`. */
export function formatExpiry(expiredAt: number, unlimitedLabel: string): string {
  if (expiredAt === I64_MAX || expiredAt === 0) return unlimitedLabel;
  const parts = utcParts(expiredAt);
  return parts ? parts.join(" · ") : unlimitedLabel;
}

/** team/views/mod.rs:782 `format_date`. */
export function formatTeamDate(tsMillis: number): string {
  const parts = utcParts(tsMillis);
  return parts ? parts.join("-") : "";
}

/**
 * Rust `format!("{:.0}", x)` for a finite, non-negative f64: the exact decimal
 * value rounded half-to-even (JS `toFixed` rounds ties up).
 */
export function formatF64NoDecimals(x: number): string {
  const floor = Math.floor(x);
  const frac = x - floor;
  if (frac === 0.5) return String(floor % 2 === 0 ? floor : floor + 1);
  return String(Math.round(x));
}
