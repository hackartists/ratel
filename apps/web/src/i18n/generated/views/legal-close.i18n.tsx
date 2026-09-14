// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/views/legal_close.rs (`LegalCloseTranslate`). Namespace "legalClose".
import { useTranslation } from "react-i18next";

const en = {
  close: "Close",
};

const ko: Record<keyof typeof en, string> = {
  close: "닫기",
};

export const i18n = { en, ko };

export interface LegalCloseI18n {
  close: string;
}

export function useLegalCloseI18n(): LegalCloseI18n {
  const { t } = useTranslation("legalClose");
  return {
    close: t("close"),
  };
}
