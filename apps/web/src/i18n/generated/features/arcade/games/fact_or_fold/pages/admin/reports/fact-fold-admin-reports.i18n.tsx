// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/arcade/games/fact_or_fold/pages/admin/reports/i18n.rs (`FactFoldAdminReportsTranslate`). Namespace "factFoldAdminReports".
import { useTranslation } from "react-i18next";

const en = {
  page_title: "Reports",
  notice_title: "Reports land in PR4",
  notice_body: "User reports require the FactFoldReport entity + chat surface (PR5). Tabs and empty list are placeholders so navigation stays consistent.",
  tab_open: "Open",
  tab_resolved: "Resolved",
  tab_dismissed: "Dismissed",
  empty: "No reports yet.",
};

const ko: Record<keyof typeof en, string> = {
  page_title: "신고",
  notice_title: "신고는 PR4에 채워집니다",
  notice_body: "사용자 신고는 FactFoldReport 엔티티 + 채팅 화면(PR5)이 필요합니다. 탭과 빈 리스트는 navigation 일관성 유지를 위한 placeholder입니다.",
  tab_open: "처리 대기",
  tab_resolved: "해결됨",
  tab_dismissed: "기각",
  empty: "신고가 없습니다.",
};

export const i18n = { en, ko };

export interface FactFoldAdminReportsI18n {
  pageTitle: string;
  noticeTitle: string;
  noticeBody: string;
  tabOpen: string;
  tabResolved: string;
  tabDismissed: string;
  empty: string;
}

export function useFactFoldAdminReportsI18n(): FactFoldAdminReportsI18n {
  const { t } = useTranslation("factFoldAdminReports");
  return {
    pageTitle: t("page_title"),
    noticeTitle: t("notice_title"),
    noticeBody: t("notice_body"),
    tabOpen: t("tab_open"),
    tabResolved: t("tab_resolved"),
    tabDismissed: t("tab_dismissed"),
    empty: t("empty"),
  };
}
