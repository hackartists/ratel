// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/social/pages/reward/user/components/reward_history_section.rs (`RewardHistorySectionTranslate`). Namespace "rewardHistorySection".
import { useTranslation } from "react-i18next";

const en = {
  title: "Reward History",
  col_space: "Space",
  col_action: "Action",
  col_point: "Points",
  col_date: "Earned at",
  empty: "No reward history yet.",
  pts_unit: "pts",
  load_more: "Load more",
  loading: "Loading…",
};

const ko: Record<keyof typeof en, string> = {
  title: "리워드 히스토리",
  col_space: "스페이스",
  col_action: "액션",
  col_point: "획득 포인트",
  col_date: "획득 시간",
  empty: "아직 리워드 히스토리가 없습니다.",
  pts_unit: "pts",
  load_more: "더보기",
  loading: "불러오는 중…",
};

export const i18n = { en, ko };

export interface RewardHistorySectionI18n {
  title: string;
  colSpace: string;
  colAction: string;
  colPoint: string;
  colDate: string;
  empty: string;
  ptsUnit: string;
  loadMore: string;
  loading: string;
}

export function useRewardHistorySectionI18n(): RewardHistorySectionI18n {
  const { t } = useTranslation("rewardHistorySection");
  return {
    title: t("title"),
    colSpace: t("col_space"),
    colAction: t("col_action"),
    colPoint: t("col_point"),
    colDate: t("col_date"),
    empty: t("empty"),
    ptsUnit: t("pts_unit"),
    loadMore: t("load_more"),
    loading: t("loading"),
  };
}
