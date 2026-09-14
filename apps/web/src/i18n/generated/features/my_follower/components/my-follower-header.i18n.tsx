// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/my_follower/components/i18n.rs (`MyFollowerHeaderTranslate`). Namespace "myFollowerHeader".
import { useTranslation } from "react-i18next";

const en = {
  title: "My Network",
};

const ko: Record<keyof typeof en, string> = {
  title: "내 네트워크",
};

export const i18n = { en, ko };

export interface MyFollowerHeaderI18n {
  title: string;
}

export function useMyFollowerHeaderI18n(): MyFollowerHeaderI18n {
  const { t } = useTranslation("myFollowerHeader");
  return {
    title: t("title"),
  };
}
