// Formatting helpers local to the Essence Sources page — `format_thousands`
// (hero/component.rs, sources_table/component.rs), `format_relative_time`
// (sources_table/component.rs) and `common::utils::html::strip_html_tags`.

/** "1,204" — thousands separators on a non-negative integer. */
export function formatThousands(n: number): string {
  return String(Math.max(0, Math.trunc(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * "just now" / "2m ago" / "3h ago" / "yesterday" / "3d ago" from unix seconds.
 * English-only in the Rust source as well (no `translate!` entry), kept as-is.
 */
export function formatRelativeTime(tsSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const delta = Math.max(now - tsSeconds, 0);
  if (delta < 60) return "just now";
  if (delta < 60 * 60) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 24 * 60 * 60) return `${Math.floor(delta / 3_600)}h ago`;
  if (delta < 48 * 60 * 60) return "yesterday";
  return `${Math.floor(delta / 86_400)}d ago`;
}

/** Tags replaced by a space, then whitespace collapsed to single spaces. */
export function stripHtmlTags(input: string): string {
  return input
    .replace(/<[^>]+>/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}
