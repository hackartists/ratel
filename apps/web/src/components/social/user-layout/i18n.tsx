// Ported from: app/ratel/src/features/social/layout.rs (`TeamMenuTranslate`). Namespace "teamMenu".
import { useTranslation } from "react-i18next";

const en = {
  sign_up: "Sign up",
  log_in: "Log in",
  back_to_page: "Back to page",
  drafts: "Draft",
  rewards: "Rewards",
  settings: "Settings",
  log_out: "Log out",
};

const ko: Record<keyof typeof en, string> = {
  sign_up: "회원가입",
  log_in: "로그인",
  back_to_page: "페이지로 돌아가기",
  drafts: "초안",
  rewards: "리워드",
  settings: "설정",
  log_out: "로그아웃",
};

export const i18n = { en, ko };

export interface TeamMenuI18n {
  signUp: string;
  logIn: string;
  backToPage: string;
  drafts: string;
  rewards: string;
  settings: string;
  logOut: string;
}

export function useTeamMenuI18n(): TeamMenuI18n {
  const { t } = useTranslation("teamMenu");
  return {
    signUp: t("sign_up"),
    logIn: t("log_in"),
    backToPage: t("back_to_page"),
    drafts: t("drafts"),
    rewards: t("rewards"),
    settings: t("settings"),
    logOut: t("log_out"),
  };
}
