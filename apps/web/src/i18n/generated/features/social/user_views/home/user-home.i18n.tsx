// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/social/user_views/home/mod.rs (`UserHomeTranslate`). Namespace "userHome".
import { useTranslation } from "react-i18next";

const en = {
  create: "Create",
};

const ko: Record<keyof typeof en, string> = {
  create: "작성",
};

export const i18n = { en, ko };

export interface UserHomeI18n {
  create: string;
}

export function useUserHomeI18n(): UserHomeI18n {
  const { t } = useTranslation("userHome");
  return {
    create: t("create"),
  };
}
