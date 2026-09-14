// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/arcade/games/fact_or_fold/pages/admin/subjects/i18n.rs (`FactFoldAdminSubjectsTranslate`). Namespace "factFoldAdminSubjects".
import { useTranslation } from "react-i18next";

const en = {
  page_title: "Subjects",
  empty: "No subjects yet — start with the New subject button.",
  kpi_total: "Loaded",
  kpi_live: "Live",
  kpi_scheduled: "Scheduled",
  kpi_draft: "Drafts",
  tab_all: "All",
  tab_live: "Live",
  tab_scheduled: "Scheduled",
  tab_draft: "Drafts",
  tab_settled: "Settled",
  col_id: "Round ID",
  col_subject: "Subject",
  col_verdict: "Verdict",
  col_tags: "Tags",
  col_scheduled: "Scheduled",
  col_expires: "Active until",
  col_status: "Status",
  expires_none: "—",
  expires_expired: "EXPIRED",
  action_publish: "Publish now",
  action_delete: "Soft-delete",
};

const ko: Record<keyof typeof en, string> = {
  page_title: "대상",
  empty: "대상이 없습니다 — 우상단의 신규 대상 버튼으로 시작하세요.",
  kpi_total: "현재 페이지",
  kpi_live: "진행 중",
  kpi_scheduled: "예약",
  kpi_draft: "초안",
  tab_all: "전체",
  tab_live: "LIVE",
  tab_scheduled: "예약",
  tab_draft: "초안",
  tab_settled: "완료",
  col_id: "라운드 ID",
  col_subject: "대상",
  col_verdict: "정답",
  col_tags: "카테고리",
  col_scheduled: "공개 일시",
  col_expires: "활성 종료",
  col_status: "상태",
  expires_none: "—",
  expires_expired: "만료됨",
  action_publish: "지금 발행",
  action_delete: "삭제",
};

export const i18n = { en, ko };

export interface FactFoldAdminSubjectsI18n {
  pageTitle: string;
  empty: string;
  kpiTotal: string;
  kpiLive: string;
  kpiScheduled: string;
  kpiDraft: string;
  tabAll: string;
  tabLive: string;
  tabScheduled: string;
  tabDraft: string;
  tabSettled: string;
  colId: string;
  colSubject: string;
  colVerdict: string;
  colTags: string;
  colScheduled: string;
  colExpires: string;
  colStatus: string;
  expiresNone: string;
  expiresExpired: string;
  actionPublish: string;
  actionDelete: string;
}

export function useFactFoldAdminSubjectsI18n(): FactFoldAdminSubjectsI18n {
  const { t } = useTranslation("factFoldAdminSubjects");
  return {
    pageTitle: t("page_title"),
    empty: t("empty"),
    kpiTotal: t("kpi_total"),
    kpiLive: t("kpi_live"),
    kpiScheduled: t("kpi_scheduled"),
    kpiDraft: t("kpi_draft"),
    tabAll: t("tab_all"),
    tabLive: t("tab_live"),
    tabScheduled: t("tab_scheduled"),
    tabDraft: t("tab_draft"),
    tabSettled: t("tab_settled"),
    colId: t("col_id"),
    colSubject: t("col_subject"),
    colVerdict: t("col_verdict"),
    colTags: t("col_tags"),
    colScheduled: t("col_scheduled"),
    colExpires: t("col_expires"),
    colStatus: t("col_status"),
    expiresNone: t("expires_none"),
    expiresExpired: t("expires_expired"),
    actionPublish: t("action_publish"),
    actionDelete: t("action_delete"),
  };
}
