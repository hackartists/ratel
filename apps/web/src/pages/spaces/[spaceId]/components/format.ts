// app/ratel/src/features/spaces/pages/index/component.rs:207 `format_number`
// (integer division, like the Rust i64 arithmetic).
export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${Math.trunc(n / 1_000_000)}M`;
  if (n >= 1_000) return `${Math.trunc(n / 1_000)}K`;
  return String(n);
}

/** `DEFAULT_LOGO` (index/component.rs:6, arena_viewer/component.rs:7). */
export const DEFAULT_LOGO = "https://metadata.ratel.foundation/logos/logo-symbol.png";
/** `DEFAULT_PROFILE` (arena_viewer, overview_panel). */
export const DEFAULT_PROFILE = "https://metadata.ratel.foundation/ratel/default-profile.png";
