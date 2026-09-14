// i18next setup for the React app, following the biyard/asset console
// convention: every bundle is a co-located `*.i18n.tsx` module exporting
// `i18n = { en, ko }` plus a typed `use<Name>I18n()` hook, registered here as
// a namespace. During the migration the bundles are generated from the Dioxus
// `translate!` blocks (`./generated`, packages/i18n-extract).
//
// Language rules mirror packages/dioxus-translate so existing users keep their
// setting and server error messages stay in the same language
// (docs/superpower/2026-09-14-react-frontend-migration.md §7):
//   - `localStorage["language"]`, else the browser language, else English;
//   - any stored value other than "ko" reads as English (Rust `FromStr`);
//   - `setLanguage` persists to `localStorage["language"]` and the
//     `language` cookie the server reads (Rust `Language::switch`).
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { modules } from "./generated";

export const SUPPORTED_LANGUAGES = ["en", "ko"] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const LANG_STORAGE_KEY = "language";

const en: Record<string, Record<string, unknown>> = {};
const ko: Record<string, Record<string, unknown>> = {};
for (const [ns, mod] of Object.entries(modules)) {
  en[ns] = mod.en;
  ko[ns] = mod.ko;
}
const namespaces = Object.keys(modules);

/**
 * Prerendered HTML is always English; the client switches to the persisted or
 * browser language in `applyPersistedLanguage()` after hydration.
 */
export function initI18n(isClient: boolean): typeof i18n {
  if (i18n.isInitialized) return i18n;
  void isClient;
  void i18n.use(initReactI18next).init({
    resources: { en, ko },
    lng: "en",
    fallbackLng: "en",
    supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
    nonExplicitSupportedLngs: true,
    ns: namespaces,
    defaultNS: false,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    initImmediate: false,
  });
  return i18n;
}

export function parseLanguage(value: string | null | undefined): AppLanguage {
  return value?.startsWith("ko") ? "ko" : "en";
}

function detectLanguage(): AppLanguage {
  try {
    const saved = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (saved !== null) return parseLanguage(saved);
  } catch {
    // storage blocked: fall through to the browser language
  }
  return parseLanguage(window.navigator?.language);
}

export function setLanguage(lang: AppLanguage): void {
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // storage blocked: the cookie and in-memory language still switch
  }
  document.cookie = `language=${lang}; path=/;`;
  if (lang !== i18n.resolvedLanguage) void i18n.changeLanguage(lang);
}

export function applyPersistedLanguage(): void {
  if (typeof window === "undefined") return;
  const lang = detectLanguage();
  if (lang !== i18n.resolvedLanguage) void i18n.changeLanguage(lang);
}

export default i18n;
