// Number formatting shared by the launchpad-partner views
// (app/ratel/src/features/launchpad_partner/views/*.rs).

function groupDigits(value: number): string {
  return Math.abs(Math.trunc(value))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** reward_hero.rs `fmt_commas` / return_page.rs `commas`: `-1,234`. */
export function fmtCommas(value: number): string {
  return `${value < 0 ? "-" : ""}${groupDigits(value)}`;
}

/** conversion_modal.rs `format_with_commas`: digits of `abs(value)`, no sign. */
export function fmtCommasUnsigned(value: number): string {
  return groupDigits(value);
}
