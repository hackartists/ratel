import type { File, SubTeamApplicationResponse } from "@ratel/ts-bridges";

// Pure helpers ported from the management tabs
// (app/ratel/src/features/sub_team/pages/management/*.rs) and
// app/ratel/src/features/sub_team/{types/text.rs, pages/doc_compose/component.rs}.

const DAY_MS = 86_400_000;

/** `chrono::Utc.timestamp_millis_opt(ts).format("%Y-%m-%d")`. */
export function formatYmd(ts: number): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/** Rust `(now - ts) / 86_400_000` (truncating) then `.max(0)`. */
export function diffDays(ts: number): number {
  return Math.max(Math.trunc((Date.now() - ts) / DAY_MS), 0);
}

/** Rust `str.chars().count()`. */
export function charCount(s: string): number {
  return Array.from(s).length;
}

/** `strip_html_to_plain` (types/text.rs). */
export function stripHtmlToPlain(html: string): string {
  let out = "";
  let inTag = false;
  let lastWasSpace = false;
  for (const c of html) {
    if (c === "<") {
      inTag = true;
    } else if (c === ">") {
      inTag = false;
      if (!lastWasSpace && out.length > 0) {
        out += " ";
        lastWasSpace = true;
      }
    } else if (inTag) {
      // skip
    } else if (/\s/u.test(c)) {
      if (!lastWasSpace && out.length > 0) {
        out += " ";
        lastWasSpace = true;
      }
    } else {
      out += c;
      lastWasSpace = false;
    }
  }
  return out
    .trimEnd()
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

/** `strip_html_chars` (broadcast_tab.rs). */
export function stripHtmlChars(html: string): number {
  let count = 0;
  let inTag = false;
  for (const ch of html) {
    if (ch === "<") inTag = true;
    else if (ch === ">") inTag = false;
    else if (!inTag) count += 1;
  }
  return count;
}

/** `parse_size_to_bytes` (doc_compose/component.rs). */
export function parseSizeToBytes(s: string): number {
  const upper = s.trim().toUpperCase();
  let num = upper;
  let mul = 1;
  if (upper.endsWith("MB")) {
    num = upper.slice(0, -2);
    mul = 1024 * 1024;
  } else if (upper.endsWith("KB")) {
    num = upper.slice(0, -2);
    mul = 1024;
  } else if (upper.endsWith("B")) {
    num = upper.slice(0, -1);
  }
  const trimmed = num.trim();
  const v = trimmed === "" ? 0 : Number(trimmed);
  return Math.floor(Math.max(Number.isFinite(v) ? v : 0, 0) * mul);
}

/** `pretty_size` (doc_compose/component.rs). */
export function prettySize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(bytes / 1024, 1).toFixed(0)} KB`;
}

export function totalAttachmentBytes(files: File[]): number {
  return files.reduce((sum, f) => sum + parseSizeToBytes(f.size), 0);
}

/** `s.parse::<i32>()`. */
export function parseI32(s: string): number | null {
  if (!/^[+-]?\d+$/.test(s)) return null;
  const n = Number(s);
  if (n > 2147483647 || n < -2147483648) return null;
  return n;
}

// ── queue_tab.rs ─────────────────────────────────────────────────────

/** `short_id`. */
export function shortId(id: string): string {
  return Array.from(id).slice(0, 8).join("");
}

/** `team_initials`. */
export function teamInitials(name: string): string {
  return name
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => Array.from(w)[0] ?? "")
    .join("")
    .toUpperCase();
}

/** `avatar_variant_for` — wrapping byte sum of the id. */
export function avatarVariantFor(id: string): string {
  const VARIANTS = ["avatar--teal", "avatar--violet", "avatar--purple", "avatar--cyan"];
  let h = 0;
  for (const b of new TextEncoder().encode(id)) h = (h + b) >>> 0;
  return VARIANTS[h % VARIANTS.length];
}

/** `format_when`. */
export function formatWhen(ms: number): string {
  if (ms <= 0) return "";
  return formatYmd(ms);
}

/** `build_snapshot_rows` — (label, value) rows, locked fields first. */
export function buildSnapshotRows(app: SubTeamApplicationResponse): [string, string][] {
  const snapshot = [...app.form_snapshot];
  snapshot.sort((a, b) => Number(b.locked) - Number(a.locked) || a.order - b.order);
  return snapshot.map((field) => {
    const raw = app.form_values[field.field_id];
    let value: string;
    if (raw === undefined || raw === null) value = "";
    else if (typeof raw === "string") value = raw;
    else if (typeof raw === "number") value = String(raw);
    else if (typeof raw === "boolean") value = raw ? "true" : "false";
    else if (Array.isArray(raw)) value = raw.filter((v): v is string => typeof v === "string").join(", ");
    else value = JSON.stringify(raw);
    return [field.label, value];
  });
}
