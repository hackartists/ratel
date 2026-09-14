// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/social/pages/reward/team/views/i18n.rs (`TeamRewardsTranslate`). Namespace "teamRewards".
import { useTranslation } from "react-i18next";

const en = {
  page_title: "Team Rewards",
  back: "Back",
  cycle_label: "Cycle",
  section_label_prefix: "Team",
  section_label_strong: "Rewards",
  earning_this_cycle: "Team earnings · this cycle",
  points: "Points",
  share_of_pool: "Share of Pool",
  of_total: "of",
  total_points_unit: "total pts",
  your_position: "TEAM POSITION",
  rank_of: "RANK",
  estimated_tokens: "Estimated tokens",
  cycle_locks_in: "Cycle locks in",
  claim_opens: "— claim opens next cycle.",
  treasury_rate: "Treasury Rate",
  per_token: "per token",
  price_desc: "Backed 1:1 by treasury reserve. Rate updates every block.",
  stat_treasury: "Treasury",
  stat_circulating: "Circulating",
  stat_backing: "Backing",
  backing_value: "100%",
  backing_unit: "collateralized",
  price_chart_title: "Price · last 30 days",
  chart_points_tokens: "Points",
  chart_subtitle: "Last 6 cycles · Monthly",
  chart_legend_points: "Points",
  chart_legend_tokens: "Tokens",
  source_breakdown: "Source Breakdown",
  source_subtitle: "This cycle · Earned points",
  donut_label: "POINTS · NOW",
  activity_title: "This Cycle's Activity",
  entries: "entries",
  load_more: "Load more",
  loading: "Loading…",
  activity_empty: "No team activity yet this cycle.",
  past_cycles: "Past Cycles",
  claimable: "claimable",
  swap_all: "Swap All",
  swap_coming_soon: "Coming soon",
  swap_coming_soon_note: "Token swap is coming soon",
  claimed: "Claimed",
  stat_points: "Points",
  stat_share: "Share",
  stat_tokens: "Tokens",
  past_empty_title: "No past cycles yet",
  past_empty_desc: "The first cycle wraps up at month-end. Tokens become claimable on the 1st of next month.",
  pts_unit: "pts",
  admin_only: "Admin access required to claim team rewards.",
};

const ko: Record<keyof typeof en, string> = {
  page_title: "팀 리워드",
  back: "뒤로",
  cycle_label: "사이클",
  section_label_prefix: "팀",
  section_label_strong: "리워드",
  earning_this_cycle: "팀 이번 사이클 획득",
  points: "포인트",
  share_of_pool: "풀 비율",
  of_total: "/",
  total_points_unit: "전체 pts",
  your_position: "팀 순위",
  rank_of: "랭크",
  estimated_tokens: "예상 토큰",
  cycle_locks_in: "사이클 종료까지",
  claim_opens: "— 다음 사이클에 청구 가능",
  treasury_rate: "트레저리 환율",
  per_token: "토큰당",
  price_desc: "트레저리 준비금 1:1 담보. 매 블록 갱신.",
  stat_treasury: "트레저리",
  stat_circulating: "유통량",
  stat_backing: "담보율",
  backing_value: "100%",
  backing_unit: "담보",
  price_chart_title: "가격 · 최근 30일",
  chart_points_tokens: "포인트",
  chart_subtitle: "최근 6 사이클 · 월별",
  chart_legend_points: "포인트",
  chart_legend_tokens: "토큰",
  source_breakdown: "획득 경로",
  source_subtitle: "이번 사이클 · 획득 포인트",
  donut_label: "포인트 · 현재",
  activity_title: "이번 사이클 활동",
  entries: "항목",
  load_more: "더 보기",
  loading: "로딩 중…",
  activity_empty: "아직 팀 활동 내역이 없습니다.",
  past_cycles: "이전 사이클",
  claimable: "청구 가능",
  swap_all: "전체 스왑",
  swap_coming_soon: "준비 중",
  swap_coming_soon_note: "토큰 스왑은 곧 출시됩니다",
  claimed: "청구 완료",
  stat_points: "포인트",
  stat_share: "비율",
  stat_tokens: "토큰",
  past_empty_title: "아직 이전 사이클이 없습니다",
  past_empty_desc: "첫 사이클은 월말에 마감됩니다.",
  pts_unit: "pts",
  admin_only: "팀 리워드 클레임은 관리자만 가능합니다.",
};

export const i18n = { en, ko };

export interface TeamRewardsI18n {
  pageTitle: string;
  back: string;
  cycleLabel: string;
  sectionLabelPrefix: string;
  sectionLabelStrong: string;
  earningThisCycle: string;
  points: string;
  shareOfPool: string;
  ofTotal: string;
  totalPointsUnit: string;
  yourPosition: string;
  rankOf: string;
  estimatedTokens: string;
  cycleLocksIn: string;
  claimOpens: string;
  treasuryRate: string;
  perToken: string;
  priceDesc: string;
  statTreasury: string;
  statCirculating: string;
  statBacking: string;
  backingValue: string;
  backingUnit: string;
  priceChartTitle: string;
  chartPointsTokens: string;
  chartSubtitle: string;
  chartLegendPoints: string;
  chartLegendTokens: string;
  sourceBreakdown: string;
  sourceSubtitle: string;
  donutLabel: string;
  activityTitle: string;
  entries: string;
  loadMore: string;
  loading: string;
  activityEmpty: string;
  pastCycles: string;
  claimable: string;
  swapAll: string;
  swapComingSoon: string;
  swapComingSoonNote: string;
  claimed: string;
  statPoints: string;
  statShare: string;
  statTokens: string;
  pastEmptyTitle: string;
  pastEmptyDesc: string;
  ptsUnit: string;
  adminOnly: string;
}

export function useTeamRewardsI18n(): TeamRewardsI18n {
  const { t } = useTranslation("teamRewards");
  return {
    pageTitle: t("page_title"),
    back: t("back"),
    cycleLabel: t("cycle_label"),
    sectionLabelPrefix: t("section_label_prefix"),
    sectionLabelStrong: t("section_label_strong"),
    earningThisCycle: t("earning_this_cycle"),
    points: t("points"),
    shareOfPool: t("share_of_pool"),
    ofTotal: t("of_total"),
    totalPointsUnit: t("total_points_unit"),
    yourPosition: t("your_position"),
    rankOf: t("rank_of"),
    estimatedTokens: t("estimated_tokens"),
    cycleLocksIn: t("cycle_locks_in"),
    claimOpens: t("claim_opens"),
    treasuryRate: t("treasury_rate"),
    perToken: t("per_token"),
    priceDesc: t("price_desc"),
    statTreasury: t("stat_treasury"),
    statCirculating: t("stat_circulating"),
    statBacking: t("stat_backing"),
    backingValue: t("backing_value"),
    backingUnit: t("backing_unit"),
    priceChartTitle: t("price_chart_title"),
    chartPointsTokens: t("chart_points_tokens"),
    chartSubtitle: t("chart_subtitle"),
    chartLegendPoints: t("chart_legend_points"),
    chartLegendTokens: t("chart_legend_tokens"),
    sourceBreakdown: t("source_breakdown"),
    sourceSubtitle: t("source_subtitle"),
    donutLabel: t("donut_label"),
    activityTitle: t("activity_title"),
    entries: t("entries"),
    loadMore: t("load_more"),
    loading: t("loading"),
    activityEmpty: t("activity_empty"),
    pastCycles: t("past_cycles"),
    claimable: t("claimable"),
    swapAll: t("swap_all"),
    swapComingSoon: t("swap_coming_soon"),
    swapComingSoonNote: t("swap_coming_soon_note"),
    claimed: t("claimed"),
    statPoints: t("stat_points"),
    statShare: t("stat_share"),
    statTokens: t("stat_tokens"),
    pastEmptyTitle: t("past_empty_title"),
    pastEmptyDesc: t("past_empty_desc"),
    ptsUnit: t("pts_unit"),
    adminOnly: t("admin_only"),
  };
}
