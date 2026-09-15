// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/social/pages/membership/user/views/mod.rs (`MembershipPageTranslate`). Namespace "membershipPage".
import { useTranslation } from "react-i18next";

const en = {
  title: "Membership",
  current_plan: "Current Plan",
  tier: "Tier",
  enterprise: "Enterprise",
  total_credits: "Total Credits",
  remaining_credits: "Remaining Credits",
  expiration: "Expires",
  next_membership: "Next Membership",
  scheduled_downgrade: "Scheduled Downgrade",
  purchase_history: "Purchase History",
  transaction_type: "Type",
  amount: "Amount",
  payment_id: "Payment ID",
  date: "Date",
  no_purchases: "No purchase history",
  unlimited: "Unlimited",
};

const ko: Record<keyof typeof en, string> = {
  title: "멤버십",
  current_plan: "현재 플랜",
  tier: "등급",
  enterprise: "엔터프라이즈",
  total_credits: "총 크레딧",
  remaining_credits: "남은 크레딧",
  expiration: "만료일",
  next_membership: "다음 멤버십",
  scheduled_downgrade: "예정된 다운그레이드",
  purchase_history: "구매 내역",
  transaction_type: "유형",
  amount: "금액",
  payment_id: "결제 ID",
  date: "날짜",
  no_purchases: "구매 내역이 없습니다",
  unlimited: "무제한",
};

export const i18n = { en, ko };

export interface MembershipPageI18n {
  title: string;
  currentPlan: string;
  tier: string;
  enterprise: string;
  totalCredits: string;
  remainingCredits: string;
  expiration: string;
  nextMembership: string;
  scheduledDowngrade: string;
  purchaseHistory: string;
  transactionType: string;
  amount: string;
  paymentId: string;
  date: string;
  noPurchases: string;
  unlimited: string;
}

export function useMembershipPageI18n(): MembershipPageI18n {
  const { t } = useTranslation("membershipPage");
  return {
    title: t("title"),
    currentPlan: t("current_plan"),
    tier: t("tier"),
    enterprise: t("enterprise"),
    totalCredits: t("total_credits"),
    remainingCredits: t("remaining_credits"),
    expiration: t("expiration"),
    nextMembership: t("next_membership"),
    scheduledDowngrade: t("scheduled_downgrade"),
    purchaseHistory: t("purchase_history"),
    transactionType: t("transaction_type"),
    amount: t("amount"),
    paymentId: t("payment_id"),
    date: t("date"),
    noPurchases: t("no_purchases"),
    unlimited: t("unlimited"),
  };
}
