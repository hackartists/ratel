// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/membership/components/membership_purchase_modal/i18n.rs (`MembershipPurchaseTranslate`). Namespace "membershipPurchase".
import { useTranslation } from "react-i18next";

const en = {
  cancel_button: "Cancel",
  confirm_button: "Proceed to Payment",
  membership_label: "Membership",
  tier_free: "Free",
  tier_pro: "Pro",
  tier_max: "Max",
  tier_vip: "VIP",
  tier_enterprise: "Enterprise",
  monthly_subscription: "Monthly subscription",
  full_name_label: "Full Name *",
  card_number_label: "Card Number *",
  card_number_placeholder: "Enter card number",
  expiry_label: "Expiry Date *",
  expiry_month_placeholder: "MM",
  expiry_year_placeholder: "YY",
  birth_or_biz_label: "Birth Date / Business Registration Number *",
  birth_or_biz_placeholder: "YYMMDD or 10 digits",
  card_password_label: "Card Password (first 2 digits) *",
  card_password_placeholder: "**",
};

const ko: Record<keyof typeof en, string> = {
  cancel_button: "취소",
  confirm_button: "결제 진행",
  membership_label: "멤버십",
  tier_free: "무료",
  tier_pro: "Pro",
  tier_max: "Max",
  tier_vip: "VIP",
  tier_enterprise: "엔터프라이즈",
  monthly_subscription: "월간 구독",
  full_name_label: "성명 *",
  card_number_label: "카드 번호 *",
  card_number_placeholder: "카드 번호를 입력하세요",
  expiry_label: "유효 기간 *",
  expiry_month_placeholder: "MM",
  expiry_year_placeholder: "YY",
  birth_or_biz_label: "생년월일 / 사업자등록번호 *",
  birth_or_biz_placeholder: "YYMMDD 또는 10자리",
  card_password_label: "카드 비밀번호 앞 2자리 *",
  card_password_placeholder: "**",
};

export const i18n = { en, ko };

export interface MembershipPurchaseI18n {
  cancelButton: string;
  confirmButton: string;
  membershipLabel: string;
  tierFree: string;
  tierPro: string;
  tierMax: string;
  tierVip: string;
  tierEnterprise: string;
  monthlySubscription: string;
  fullNameLabel: string;
  cardNumberLabel: string;
  cardNumberPlaceholder: string;
  expiryLabel: string;
  expiryMonthPlaceholder: string;
  expiryYearPlaceholder: string;
  birthOrBizLabel: string;
  birthOrBizPlaceholder: string;
  cardPasswordLabel: string;
  cardPasswordPlaceholder: string;
}

export function useMembershipPurchaseI18n(): MembershipPurchaseI18n {
  const { t } = useTranslation("membershipPurchase");
  return {
    cancelButton: t("cancel_button"),
    confirmButton: t("confirm_button"),
    membershipLabel: t("membership_label"),
    tierFree: t("tier_free"),
    tierPro: t("tier_pro"),
    tierMax: t("tier_max"),
    tierVip: t("tier_vip"),
    tierEnterprise: t("tier_enterprise"),
    monthlySubscription: t("monthly_subscription"),
    fullNameLabel: t("full_name_label"),
    cardNumberLabel: t("card_number_label"),
    cardNumberPlaceholder: t("card_number_placeholder"),
    expiryLabel: t("expiry_label"),
    expiryMonthPlaceholder: t("expiry_month_placeholder"),
    expiryYearPlaceholder: t("expiry_year_placeholder"),
    birthOrBizLabel: t("birth_or_biz_label"),
    birthOrBizPlaceholder: t("birth_or_biz_placeholder"),
    cardPasswordLabel: t("card_password_label"),
    cardPasswordPlaceholder: t("card_password_placeholder"),
  };
}
