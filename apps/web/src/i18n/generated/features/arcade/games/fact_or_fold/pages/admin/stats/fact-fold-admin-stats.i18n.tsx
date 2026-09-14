// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/arcade/games/fact_or_fold/pages/admin/stats/i18n.rs (`FactFoldAdminStatsTranslate`). Namespace "factFoldAdminStats".
import { useTranslation } from "react-i18next";

const en = {
  page_title: "Stats",
  notice_title: "Stats land in PR4",
  notice_body: "Round-level aggregations (accuracy, insider effect, flip count) need the FactFoldRound entity. The shell + KPI layout below mirrors the design mockup so the route stays navigable.",
  kpi_total_rounds: "Total rounds",
  kpi_avg_accuracy: "Avg accuracy",
  kpi_insider_win_rate: "Insider win rate",
  kpi_avg_flip_count: "Avg flips / round",
  no_data: "no data yet",
  panel_recent: "Last 30 rounds",
  panel_recent_sub: "Accuracy trend",
  chart_placeholder: "Chart renders once round data exists.",
  panel_breakdown: "Per-subject breakdown",
  panel_breakdown_sub: "Accuracy + insider win + flip count",
  empty: "No settled rounds yet.",
};

const ko: Record<keyof typeof en, string> = {
  page_title: "통계",
  notice_title: "통계는 PR4에 채워집니다",
  notice_body: "라운드 집계(정답률, 인사이더 효과, flip 카운트)는 FactFoldRound 엔티티가 필요합니다. 아래 KPI 레이아웃은 mockup을 따라 navigable한 상태로 유지됩니다.",
  kpi_total_rounds: "총 라운드",
  kpi_avg_accuracy: "평균 정답률",
  kpi_insider_win_rate: "인사이더 승률",
  kpi_avg_flip_count: "라운드당 평균 flip",
  no_data: "데이터 없음",
  panel_recent: "최근 30 라운드",
  panel_recent_sub: "정답률 트렌드",
  chart_placeholder: "라운드 데이터가 들어오면 차트가 렌더링됩니다.",
  panel_breakdown: "대상별 통계",
  panel_breakdown_sub: "정답률 + 인사이더 승 + flip 카운트",
  empty: "정산된 라운드가 아직 없습니다.",
};

export const i18n = { en, ko };

export interface FactFoldAdminStatsI18n {
  pageTitle: string;
  noticeTitle: string;
  noticeBody: string;
  kpiTotalRounds: string;
  kpiAvgAccuracy: string;
  kpiInsiderWinRate: string;
  kpiAvgFlipCount: string;
  noData: string;
  panelRecent: string;
  panelRecentSub: string;
  chartPlaceholder: string;
  panelBreakdown: string;
  panelBreakdownSub: string;
  empty: string;
}

export function useFactFoldAdminStatsI18n(): FactFoldAdminStatsI18n {
  const { t } = useTranslation("factFoldAdminStats");
  return {
    pageTitle: t("page_title"),
    noticeTitle: t("notice_title"),
    noticeBody: t("notice_body"),
    kpiTotalRounds: t("kpi_total_rounds"),
    kpiAvgAccuracy: t("kpi_avg_accuracy"),
    kpiInsiderWinRate: t("kpi_insider_win_rate"),
    kpiAvgFlipCount: t("kpi_avg_flip_count"),
    noData: t("no_data"),
    panelRecent: t("panel_recent"),
    panelRecentSub: t("panel_recent_sub"),
    chartPlaceholder: t("chart_placeholder"),
    panelBreakdown: t("panel_breakdown"),
    panelBreakdownSub: t("panel_breakdown_sub"),
    empty: t("empty"),
  };
}
