// chrono formatting helpers used by the settings pages.

const pad = (n: number) => String(n).padStart(2, "0");

/** `Local.timestamp_millis_opt(ms).format("%Y-%m-%d %H:%M")`, `—` for 0. */
export function formatLocalDateTime(ms: number): string {
  if (ms === 0) return "—";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** `Local.timestamp_millis_opt(ms).format("%Y-%m-%d")`, `—` for 0. */
export function formatLocalDate(ms: number): string {
  if (ms === 0) return "—";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** `Utc.timestamp_millis_opt(ms).format("%Y-%m-%d")`, empty when out of range. */
export function formatUtcDate(ms: number): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** `format_membership_tier_label` (social/pages/membership/user/components/purchase_history.rs). */
export function formatMembershipTierLabel(tier: string, enterpriseLabel: string): string {
  const stripped = tier.startsWith("MEMBERSHIP#") ? tier.slice("MEMBERSHIP#".length) : tier;
  return stripped.startsWith("ENTERPRISE#") ? enterpriseLabel : stripped;
}

/** Keeps ASCII digits only (`chars().filter(is_ascii_digit)`). */
export function digitsOnly(value: string): string {
  return value.replace(/[^0-9]/g, "");
}
