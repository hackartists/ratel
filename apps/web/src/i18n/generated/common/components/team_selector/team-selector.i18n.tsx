// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/common/components/team_selector/team_selector.rs (`TeamSelectorTranslate`). Namespace "teamSelector".
import { useTranslation } from "react-i18next";

const en = {
  teams: "Teams",
  create_team: "Create Team",
  logout: "Log Out",
};

const ko: Record<keyof typeof en, string> = {
  teams: "팀",
  create_team: "팀 생성",
  logout: "로그아웃",
};

export const i18n = { en, ko };

export interface TeamSelectorI18n {
  teams: string;
  createTeam: string;
  logout: string;
}

export function useTeamSelectorI18n(): TeamSelectorI18n {
  const { t } = useTranslation("teamSelector");
  return {
    teams: t("teams"),
    createTeam: t("create_team"),
    logout: t("logout"),
  };
}
