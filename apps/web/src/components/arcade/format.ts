// Helpers shared by the arcade pages. Each mirrors a private Rust helper that
// is copy-pasted across app/ratel/src/features/arcade/** (`avatar_variant`,
// `initials`, `str::replace("{$x}", …)`).

/** `avatar_variant(idx)` — `""`, `a2`, `a3`, `a4` cycling by index. */
export function avatarVariant(idx: number): "" | "a2" | "a3" | "a4" {
  switch (idx % 4) {
    case 0:
      return "";
    case 1:
      return "a2";
    case 2:
      return "a3";
    default:
      return "a4";
  }
}

/** `format!("p-avatar {variant}")`, or the bare base class for index 0. */
export function withVariant(base: string, idx: number): string {
  const v = avatarVariant(idx);
  return v ? `${base} ${v}` : base;
}

const ALNUM = /[\p{L}\p{N}]/u;

/** `src.chars().filter(char::is_alphanumeric).take(2).collect().to_uppercase()`. */
export function monogram(src: string): string {
  return Array.from(src)
    .filter((c) => ALNUM.test(c))
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** `initials(display, username)` — first non-empty of display / username / `?`. */
export function initials(display: string, username: string): string {
  return monogram(display || username || "?");
}

/** Display name falling back to the username (`if display_name.is_empty()`). */
export function displayName(p: { display_name: string; username: string }): string {
  return p.display_name === "" ? p.username : p.display_name;
}

/** Rust `tr.key.replace("{$name}", value)` for every entry. */
export function fill(template: string, values: Record<string, string | number>): string {
  let out = template;
  for (const [key, value] of Object.entries(values)) out = out.split(`{$${key}}`).join(String(value));
  return out;
}
