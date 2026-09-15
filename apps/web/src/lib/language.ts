import { useTranslation } from "react-i18next";
import { parseLanguage, type AppLanguage } from "@/i18n";

/**
 * The active UI language, re-rendering on change. Rust `use_language()` for
 * components that branch on the language instead of reading a `translate!`
 * bundle (e.g. the legal pages' `matches!(lang(), Language::Ko)`).
 */
export function useLanguage(): AppLanguage {
  const { i18n } = useTranslation();
  return parseLanguage(i18n.resolvedLanguage);
}
