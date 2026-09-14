// app/ratel/src/features/social/pages/reward/user/views/mod.rs `format_with_commas`
// and components/reward_history_section.rs `format_yyyy_mm_dd`.

/** `format_with_commas(value, None)`: `-1,234`. */
export function formatWithCommas(value: number): string {
  const digits = Math.abs(Math.trunc(value))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${value < 0 ? "-" : ""}${digits}`;
}

/** chrono `%Y-%m-%d` of epoch-ms in UTC; empty when out of range. */
export function formatYyyyMmDd(tsMillis: number): string {
  const date = new Date(tsMillis);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}
