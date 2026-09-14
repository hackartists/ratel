// `Visibility`/`PostStatus` (app/ratel/src/features/posts/types/{visibility,post_status}.rs)
// serialize via `SerializeDisplay` in UPPER_SNAKE_CASE ("PUBLIC"/"DRAFT"), but
// their `FromStr` also accepts UpperCamel ("Public"/"Draft") and other
// casings, so requests can send the more readable UpperCamel form (as the
// integration tests do) while reads normalize case-insensitively.

export function isVisibility(v: string | null | undefined, want: "Public" | "Private"): boolean {
  return (v ?? "Public").toUpperCase() === want.toUpperCase();
}

export function isPostStatus(v: string | null | undefined, want: "Draft" | "Published"): boolean {
  return (v ?? "Draft").toUpperCase() === want.toUpperCase();
}
