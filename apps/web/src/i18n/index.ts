// Language state for the React app, mirroring packages/dioxus-translate so
// existing users keep their setting and server error messages stay in the
// same language (docs/superpower/2026-09-14-react-frontend-migration.md §7):
//   - `localStorage["language"]`, else the browser language, else English;
//   - any stored value other than "ko" reads as English (Rust `FromStr`);
//   - switching persists to `localStorage["language"]` and the `language`
//     cookie the server reads.
// Translation bundles come from the extraction tool (`generated/`).
import { useSyncExternalStore } from "react";

export type Language = "en" | "ko";

export const STORAGE_KEY = "language";
export const DEFAULT_LANGUAGE: Language = "en";

/** A `translate!` block: the same keys in every language. */
export interface Bundle<K extends string = string> {
  en: Record<K, string>;
  ko: Record<K, string>;
}

/**
 * A `#[derive(Translate)]` enum. Variants marked `#[translate(from)]`
 * delegate to the inner type's translation and are listed in `delegates`.
 */
export interface EnumBundle<V extends string = string> extends Bundle<V> {
  delegates?: Record<string, string>;
}

export function parseLanguage(value: string): Language {
  return value === "ko" ? "ko" : "en";
}

function detectLanguage(): Language {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored !== null) return parseLanguage(stored);
  } catch {
    // storage blocked
  }
  const browser = window.navigator?.language;
  return browser ? parseLanguage(browser.split("-")[0]) : DEFAULT_LANGUAGE;
}

let current: Language | undefined;
const listeners = new Set<() => void>();

export function getLanguage(): Language {
  current ??= detectLanguage();
  return current;
}

/** Changes the language for this page view only (Rust `set_language`). */
export function setLanguage(next: Language): void {
  if (getLanguage() === next) return;
  current = next;
  for (const listener of listeners) listener();
}

/** Toggles and persists the language (Rust `Language::switch`). */
export function switchLanguage(): Language {
  const next: Language = getLanguage() === "ko" ? "en" : "ko";
  setLanguage(next);
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // storage blocked
  }
  document.cookie = `language=${next}; path=/;`;
  return next;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The server snapshot is the default so prerendered HTML hydrates cleanly. */
export function useLanguage(): Language {
  return useSyncExternalStore(subscribe, getLanguage, () => DEFAULT_LANGUAGE);
}

export function useTranslate<K extends string>(bundle: Bundle<K>): Record<K, string> {
  return bundle[useLanguage()];
}

/** Replaces `{name}` placeholders, as call sites do with `str::replace` in Rust. */
export function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}
