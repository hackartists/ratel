// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/spaces/space_common/components/space_nav/space_user_login.rs (`SpaceUserLoginTranslate`). Namespace "spaceUserLogin".
import { useTranslation } from "react-i18next";

const en = {
  title: "Join the Movement",
};

const ko: Record<keyof typeof en, string> = {
  title: "로그인 및 회원가입",
};

export const i18n = { en, ko };

export interface SpaceUserLoginI18n {
  title: string;
}

export function useSpaceUserLoginI18n(): SpaceUserLoginI18n {
  const { t } = useTranslation("spaceUserLogin");
  return {
    title: t("title"),
  };
}
