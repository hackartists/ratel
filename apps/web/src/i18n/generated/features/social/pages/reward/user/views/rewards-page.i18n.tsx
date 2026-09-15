// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/social/pages/reward/user/views/mod.rs (`RewardsPageTranslate`). Namespace "rewardsPage".
import { useTranslation } from "react-i18next";

const en = {
  title: "This month's points",
  your_share: "Your share",
  this_months_pool: "This month's pool",
  swap_available_message: "Point-to-Token Swap will be available starting next month",
  exchange_from: "from",
  exchange_to: "To",
  point: "Point",
  token: "Token",
  received: "Received",
  spent: "Spent",
  from: "from",
  empty: "No transactions",
  empty_description: "You have no point transactions yet",
  loading: "Loading...",
  error: "Error loading rewards",
  load_more: "Load more",
  yours: "Yours",
  past_months: "Reward History",
  past_months_preparing: "Token claim is being prepared",
  past_months_empty: "No past month rewards yet",
};

const ko: Record<keyof typeof en, string> = {
  title: "이번 달 포인트",
  your_share: "내 지분",
  this_months_pool: "이번 달 풀",
  swap_available_message: "포인트-토큰 스왑은 다음 달부터 가능합니다",
  exchange_from: "from",
  exchange_to: "To",
  point: "Point",
  token: "Token",
  received: "획득",
  spent: "사용",
  from: "from",
  empty: "거래 내역 없음",
  empty_description: "아직 포인트 거래 내역이 없습니다",
  loading: "로딩 중...",
  error: "리워드 로딩 오류",
  load_more: "더 보기",
  yours: "내 지분",
  past_months: "리워드 히스토리",
  past_months_preparing: "토큰 클레임 준비 중입니다",
  past_months_empty: "아직 지난 달 리워드가 없습니다",
};

export const i18n = { en, ko };

export interface RewardsPageI18n {
  title: string;
  yourShare: string;
  thisMonthsPool: string;
  swapAvailableMessage: string;
  exchangeFrom: string;
  exchangeTo: string;
  point: string;
  token: string;
  received: string;
  spent: string;
  from: string;
  empty: string;
  emptyDescription: string;
  loading: string;
  error: string;
  loadMore: string;
  yours: string;
  pastMonths: string;
  pastMonthsPreparing: string;
  pastMonthsEmpty: string;
}

export function useRewardsPageI18n(): RewardsPageI18n {
  const { t } = useTranslation("rewardsPage");
  return {
    title: t("title"),
    yourShare: t("your_share"),
    thisMonthsPool: t("this_months_pool"),
    swapAvailableMessage: t("swap_available_message"),
    exchangeFrom: t("exchange_from"),
    exchangeTo: t("exchange_to"),
    point: t("point"),
    token: t("token"),
    received: t("received"),
    spent: t("spent"),
    from: t("from"),
    empty: t("empty"),
    emptyDescription: t("empty_description"),
    loading: t("loading"),
    error: t("error"),
    loadMore: t("load_more"),
    yours: t("yours"),
    pastMonths: t("past_months"),
    pastMonthsPreparing: t("past_months_preparing"),
    pastMonthsEmpty: t("past_months_empty"),
  };
}
