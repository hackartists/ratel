// DOM parity helpers (docs/superpower/2026-09-14-react-frontend-migration.md §3.2).

/**
 * `data-*` / `aria-*` booleans as the strings Dioxus renders. `main.css` matches
 * `[data-open="true"]` and friends, and React drops `false`/`undefined`
 * attributes, so always pass a string.
 */
export function dataBool(value: boolean): "true" | "false" {
  return value ? "true" : "false";
}

/**
 * How dioxus_primitives' `merge_attributes` combines two `class` values: each
 * is trimmed, and they are joined with one space only when both are non-empty.
 * A missing second value leaves the first untouched (no trim), exactly like a
 * component that received no extra `class` attribute.
 */
export function joinClass(base: string, extra: string | undefined): string {
  if (extra === undefined) return base;
  const a = base.trim();
  const b = extra.trim();
  return a && b ? `${a} ${b}` : `${a}${b}`;
}
