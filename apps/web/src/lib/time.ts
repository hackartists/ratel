// app/ratel/src/common/utils/time.rs (`time_ago`) — not translated in Rust
// either (hardcoded "s/m/h/d/w/y ago"); ported verbatim.
export function timeAgo(timestampMillis: number): string {
  const now = Date.now();
  const diff = now - timestampMillis;

  if (diff < 60 * 1000) return `${Math.trunc(diff / 1000)}s ago`;
  if (diff < 3600 * 1000) return `${Math.trunc(diff / 1000 / 60)}m ago`;
  if (diff < 86400 * 1000) return `${Math.trunc(diff / 1000 / 3600)}h ago`;
  if (diff < 604800 * 1000) return `${Math.trunc(diff / 1000 / 86400)}d ago`;
  if (diff < 31536000 * 1000) return `${Math.trunc(diff / 1000 / 604800)}w ago`;
  return `${Math.trunc(diff / 1000 / 31536000)}y ago`;
}
