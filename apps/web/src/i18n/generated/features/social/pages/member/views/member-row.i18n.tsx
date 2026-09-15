// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/social/pages/member/views/i18n.rs (`MemberRowTranslate`). Namespace "memberRow".
import { useTranslation } from "react-i18next";

const en = {
  team_owner: "Team owner",
};

const ko: Record<keyof typeof en, string> = {
  team_owner: "팀 소유자",
};

export const i18n = { en, ko };

export interface MemberRowI18n {
  teamOwner: string;
}

export function useMemberRowI18n(): MemberRowI18n {
  const { t } = useTranslation("memberRow");
  return {
    teamOwner: t("team_owner"),
  };
}
