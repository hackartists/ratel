// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/social/layout.rs (`SocialTranslate`). Namespace "social".
import { useTranslation } from "react-i18next";

const en = {
  redirect_label: "Go to User's Wall",
};

const ko: Record<keyof typeof en, string> = {
  redirect_label: "사용자 페이지로 이동",
};

export const i18n = { en, ko };

export interface SocialI18n {
  redirectLabel: string;
}

export function useSocialI18n(): SocialI18n {
  const { t } = useTranslation("social");
  return {
    redirectLabel: t("redirect_label"),
  };
}
