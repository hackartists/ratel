// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/social/pages/member/views/i18n.rs (`ViewerPageTranslate`). Namespace "viewerPage".
import { useTranslation } from "react-i18next";

const en = {
  no_permission: "No permission",
  no_permission_desc: "You don't have permission to manage team members.",
  team_prefix: "team:",
};

const ko: Record<keyof typeof en, string> = {
  no_permission: "권한 없음",
  no_permission_desc: "팀 멤버를 관리할 권한이 없습니다.",
  team_prefix: "팀:",
};

export const i18n = { en, ko };

export interface ViewerPageI18n {
  noPermission: string;
  noPermissionDesc: string;
  teamPrefix: string;
}

export function useViewerPageI18n(): ViewerPageI18n {
  const { t } = useTranslation("viewerPage");
  return {
    noPermission: t("no_permission"),
    noPermissionDesc: t("no_permission_desc"),
    teamPrefix: t("team_prefix"),
  };
}
