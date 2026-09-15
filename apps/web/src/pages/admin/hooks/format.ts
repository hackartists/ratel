import { ApiError } from "@ratel/ts-bridges/runtime";

// Rust value helpers the admin pages rely on, with the same results.

/** app/ratel/src/common/utils/format.rs `format_with_commas`. */
export function formatWithCommas(value: number): string {
  const sign = value < 0 ? "-" : "";
  const digits = String(Math.abs(Math.trunc(value)));
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

const INTEGER = /^[+-]?\d+$/;

/** `str::parse::<i64>()`; `null` where Rust returns `Err`. */
export function parseI64(text: string): number | null {
  if (!INTEGER.test(text)) return null;
  const value = Number(text);
  return Number.isSafeInteger(value) ? value : null;
}

/** `str::parse::<i32>()`. */
export function parseI32(text: string): number | null {
  const value = parseI64(text);
  return value !== null && value >= -2147483648 && value <= 2147483647 ? value : null;
}

const FLOAT = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
const SPECIAL_FLOAT = /^[+-]?(inf|infinity|nan)$/i;

/** `str::parse::<f64>()`. */
export function parseF64(text: string): number | null {
  if (FLOAT.test(text)) return Number(text);
  if (SPECIAL_FLOAT.test(text)) {
    if (/nan/i.test(text)) return Number.NaN;
    return text.startsWith("-") ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
  }
  return null;
}

/** `(f).round() as i32` — rounds half away from zero, saturates, NaN → 0. */
export function roundToI32(value: number): number {
  if (Number.isNaN(value)) return 0;
  const rounded = Math.sign(value) * Math.round(Math.abs(value));
  return Math.max(-2147483648, Math.min(2147483647, rounded));
}

/** `format!("{e}")` of a failed server call: the `common::Error` display text. */
export function displayError(error: unknown): string {
  if (error instanceof ApiError) return error.server?.message ?? error.body;
  if (error instanceof Error) return error.message;
  return String(error);
}

/** `str::len()` — UTF-8 byte length. */
export function utf8Length(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** `str::chars().count()`. */
export function charCount(text: string): number {
  return Array.from(text).length;
}
