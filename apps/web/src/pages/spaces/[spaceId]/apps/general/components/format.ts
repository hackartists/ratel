// Pure helpers from app/ratel/src/features/spaces/pages/apps/apps/general/views/home.

/** Square symbol mark used when the space has no logo (`DEFAULT_SPACE_LOGO`). */
export const DEFAULT_SPACE_LOGO = "https://metadata.ratel.foundation/logos/logo-symbol.png";

/** `normalize_email_inputs`: comma-separated, trimmed, lowercased, de-duplicated; `null` when invalid. */
export function normalizeEmailInputs(raw: string): string[] | null {
  const emails = raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value !== "");
  if (emails.length === 0) return null;
  const normalized: string[] = [];
  for (const email of emails) {
    if (!email.includes("@")) return null;
    if (!normalized.includes(email)) normalized.push(email);
  }
  return normalized;
}

/** `normalize_identifier_inputs`: comma-separated, trimmed, non-empty. */
export function normalizeIdentifierInputs(raw: string): string[] {
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value !== "");
}

/** `initials_for` / administrators `avatar_initials`: first letters of the first two words. */
export function wordInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter((w) => w !== "")
    .map((w) => Array.from(w)[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** invite_participant `avatar_initials`: name (or the email) split on non-alphanumerics. */
export function inviteInitials(name: string, email: string): string {
  const src = name.trim() !== "" ? name : email;
  return src
    .split(/[^\p{L}\p{N}]/u)
    .filter((s) => s !== "")
    .map((w) => Array.from(w)[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

/**
 * `epoch_ms_to_datetime_local`: `YYYY-MM-DDTHH:MM` in the browser's current
 * UTC offset (Rust reads `new Date().getTimezoneOffset()` once, not per date).
 */
export function epochMsToDatetimeLocal(ms: number): string {
  if (ms <= 0) return "";
  const offsetMin = new Date().getTimezoneOffset();
  const d = new Date(ms - offsetMin * 60_000);
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** `datetime_local_to_epoch_ms`: the inverse; `null` for anything but `YYYY-MM-DDTHH:MM`. */
export function datetimeLocalToEpochMs(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const [year, month, day, hour, minute] = m.slice(1).map(Number);
  const utc = new Date(0);
  utc.setUTCFullYear(year, month - 1, day);
  utc.setUTCHours(hour, minute, 0, 0);
  if (utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day || hour > 23 || minute > 59) return null;
  return utc.getTime() + new Date().getTimezoneOffset() * 60_000;
}
