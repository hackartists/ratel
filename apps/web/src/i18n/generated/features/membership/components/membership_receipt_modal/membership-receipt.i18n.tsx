// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/membership/components/membership_receipt_modal/i18n.rs (`MembershipReceiptTranslate`). Namespace "membershipReceipt".
import { useTranslation } from "react-i18next";

const en = {
  receipt_title: "Payment Complete",
  receipt_thank_you: "Thank you for your purchase",
  receipt_transaction_id: "Transaction ID",
  membership_label: "Membership",
  tier_free: "Free",
  tier_pro: "Pro",
  tier_max: "Max",
  tier_vip: "VIP",
  tier_enterprise: "Enterprise",
  receipt_amount: "Amount",
  receipt_duration: "Duration",
  receipt_days: "days",
  receipt_credits: "Credits",
  receipt_paid_at: "Payment Date",
  receipt_close: "Close",
};

const ko: Record<keyof typeof en, string> = {
  receipt_title: "결제 완료!",
  receipt_thank_you: "구매해 주셔서 감사합니다",
  receipt_transaction_id: "거래 번호",
  membership_label: "멤버십",
  tier_free: "무료",
  tier_pro: "Pro",
  tier_max: "Max",
  tier_vip: "VIP",
  tier_enterprise: "엔터프라이즈",
  receipt_amount: "결제 금액",
  receipt_duration: "기간",
  receipt_days: "일",
  receipt_credits: "크레딧",
  receipt_paid_at: "결제 날짜",
  receipt_close: "닫기",
};

export const i18n = { en, ko };

export interface MembershipReceiptI18n {
  receiptTitle: string;
  receiptThankYou: string;
  receiptTransactionId: string;
  membershipLabel: string;
  tierFree: string;
  tierPro: string;
  tierMax: string;
  tierVip: string;
  tierEnterprise: string;
  receiptAmount: string;
  receiptDuration: string;
  receiptDays: string;
  receiptCredits: string;
  receiptPaidAt: string;
  receiptClose: string;
}

export function useMembershipReceiptI18n(): MembershipReceiptI18n {
  const { t } = useTranslation("membershipReceipt");
  return {
    receiptTitle: t("receipt_title"),
    receiptThankYou: t("receipt_thank_you"),
    receiptTransactionId: t("receipt_transaction_id"),
    membershipLabel: t("membership_label"),
    tierFree: t("tier_free"),
    tierPro: t("tier_pro"),
    tierMax: t("tier_max"),
    tierVip: t("tier_vip"),
    tierEnterprise: t("tier_enterprise"),
    receiptAmount: t("receipt_amount"),
    receiptDuration: t("receipt_duration"),
    receiptDays: t("receipt_days"),
    receiptCredits: t("receipt_credits"),
    receiptPaidAt: t("receipt_paid_at"),
    receiptClose: t("receipt_close"),
  };
}
