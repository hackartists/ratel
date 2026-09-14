// Date helpers of app/ratel/src/features/social/pages/credentials/views/mod.rs
// and `common::utils::time::time_ago`. chrono formats in UTC with English
// month names regardless of the UI language.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const pad2 = (n: number) => String(n).padStart(2, "0");

/** One year in milliseconds (`YEAR_MS`). */
export const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/** `format_date`: chrono `%b %d, %Y`, "—" when out of range. */
export function formatDate(tsMillis: number): string {
  const d = new Date(tsMillis);
  if (Number.isNaN(d.getTime())) return "—";
  return `${MONTHS[d.getUTCMonth()]} ${pad2(d.getUTCDate())}, ${d.getUTCFullYear()}`;
}

/** `format_datetime_utc`: chrono `%Y-%m-%d %H:%M UTC`. */
export function formatDatetimeUtc(tsMillis: number): string {
  const d = new Date(tsMillis);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())} UTC`;
}

/** `time_ago` (integer division truncates toward zero, like Rust). */
export function timeAgo(tsMillis: number): string {
  const diff = Date.now() - tsMillis;
  const div = (n: number) => String(Math.trunc(diff / n) || 0);
  if (diff < 60 * 1000) return `${div(1000)}s ago`;
  if (diff < 3600 * 1000) return `${div(1000 * 60)}m ago`;
  if (diff < 86400 * 1000) return `${div(1000 * 3600)}h ago`;
  if (diff < 604800 * 1000) return `${div(1000 * 86400)}d ago`;
  if (diff < 31536000 * 1000) return `${div(1000 * 604800)}w ago`;
  return `${div(1000 * 31536000)}y ago`;
}
