// Ported from: app/ratel/src/features/social/pages/membership/team/views/i18n.rs (`TeamMembershipTranslate`). Namespace "teamMembership".
import { useTranslation } from "react-i18next";

const en = {
  section_label_prefix: "Team ·",
  section_label_strong: "Membership",
  hero_title_en: "Team Membership",
  hero_title_ko: "팀 멤버십",
  hero_desc_prefix: "Your current plan, ",
  hero_desc_credits: "Credits",
  hero_desc_suffix: ", and purchase history at a glance.",
  current_plan_label: "Current Plan",
  credits_label: "Credits",
  credits_remaining_hint: "Remaining",
  expires_label: "Expires",
  expires_unlimited: "Unlimited",
  expires_auto_renew: "Auto-renews on the expiration date.",
  downgrade_prefix: "On next billing cycle, the team will be downgraded to ",
  downgrade_suffix: ".",
  tier_free_desc: "Basic membership open to everyone",
  tier_pro_desc: "Reward spaces for small communities",
  tier_max_desc: "Reward spaces for large communities",
  tier_vip_desc: "Reward spaces for influencers and marketing partners",
  tier_enterprise_desc: "Custom partner plan for enterprises and organizations",
  enterprise_label: "Enterprise",
  history_title: "Purchase History",
  history_count_suffix_one: "record",
  history_count_suffix_many: "records",
  th_type: "Type",
  th_amount: "Amount",
  th_payment_id: "Payment ID",
  th_date: "Date",
  history_empty_title: "No Purchases Yet",
  history_empty_desc: "Purchase history will appear here after your first transaction.",
  no_permission: "You don't have permission to view this page.",
};

const ko: Record<keyof typeof en, string> = {
  section_label_prefix: "팀 ·",
  section_label_strong: "멤버십",
  hero_title_en: "Team Membership",
  hero_title_ko: "팀 멤버십",
  hero_desc_prefix: "현재 사용 중인 플랜과 ",
  hero_desc_credits: "크레딧",
  hero_desc_suffix: ", 구매 내역을 한눈에 확인하세요.",
  current_plan_label: "현재 플랜",
  credits_label: "크레딧",
  credits_remaining_hint: "남은 크레딧",
  expires_label: "만료",
  expires_unlimited: "무제한",
  expires_auto_renew: "만료일에 자동 결제됩니다.",
  downgrade_prefix: "다음 결제 주기에 ",
  downgrade_suffix: " 플랜으로 다운그레이드됩니다.",
  tier_free_desc: "누구나 참여 가능한 기본 멤버십",
  tier_pro_desc: "소규모 커뮤니티를 위한 보상 스페이스",
  tier_max_desc: "대규모 커뮤니티를 위한 보상 스페이스",
  tier_vip_desc: "인플루언서 및 마케팅 파트너를 위한 보상 스페이스",
  tier_enterprise_desc: "기업 및 기관 맞춤형 파트너 멤버십",
  enterprise_label: "엔터프라이즈",
  history_title: "구매 내역",
  history_count_suffix_one: "건",
  history_count_suffix_many: "건",
  th_type: "유형",
  th_amount: "금액",
  th_payment_id: "결제 ID",
  th_date: "날짜",
  history_empty_title: "구매 내역 없음",
  history_empty_desc: "첫 결제 이후 구매 내역이 여기에 표시됩니다.",
  no_permission: "이 페이지를 볼 수 있는 권한이 없습니다.",
};

export const i18n = { en, ko };

export interface TeamMembershipI18n {
  sectionLabelPrefix: string;
  sectionLabelStrong: string;
  heroTitleEn: string;
  heroTitleKo: string;
  heroDescPrefix: string;
  heroDescCredits: string;
  heroDescSuffix: string;
  currentPlanLabel: string;
  creditsLabel: string;
  creditsRemainingHint: string;
  expiresLabel: string;
  expiresUnlimited: string;
  expiresAutoRenew: string;
  downgradePrefix: string;
  downgradeSuffix: string;
  tierFreeDesc: string;
  tierProDesc: string;
  tierMaxDesc: string;
  tierVipDesc: string;
  tierEnterpriseDesc: string;
  enterpriseLabel: string;
  historyTitle: string;
  historyCountSuffixOne: string;
  historyCountSuffixMany: string;
  thType: string;
  thAmount: string;
  thPaymentId: string;
  thDate: string;
  historyEmptyTitle: string;
  historyEmptyDesc: string;
  noPermission: string;
}

export function useTeamMembershipI18n(): TeamMembershipI18n {
  const { t } = useTranslation("teamMembership");
  return {
    sectionLabelPrefix: t("section_label_prefix"),
    sectionLabelStrong: t("section_label_strong"),
    heroTitleEn: t("hero_title_en"),
    heroTitleKo: t("hero_title_ko"),
    heroDescPrefix: t("hero_desc_prefix"),
    heroDescCredits: t("hero_desc_credits"),
    heroDescSuffix: t("hero_desc_suffix"),
    currentPlanLabel: t("current_plan_label"),
    creditsLabel: t("credits_label"),
    creditsRemainingHint: t("credits_remaining_hint"),
    expiresLabel: t("expires_label"),
    expiresUnlimited: t("expires_unlimited"),
    expiresAutoRenew: t("expires_auto_renew"),
    downgradePrefix: t("downgrade_prefix"),
    downgradeSuffix: t("downgrade_suffix"),
    tierFreeDesc: t("tier_free_desc"),
    tierProDesc: t("tier_pro_desc"),
    tierMaxDesc: t("tier_max_desc"),
    tierVipDesc: t("tier_vip_desc"),
    tierEnterpriseDesc: t("tier_enterprise_desc"),
    enterpriseLabel: t("enterprise_label"),
    historyTitle: t("history_title"),
    historyCountSuffixOne: t("history_count_suffix_one"),
    historyCountSuffixMany: t("history_count_suffix_many"),
    thType: t("th_type"),
    thAmount: t("th_amount"),
    thPaymentId: t("th_payment_id"),
    thDate: t("th_date"),
    historyEmptyTitle: t("history_empty_title"),
    historyEmptyDesc: t("history_empty_desc"),
    noPermission: t("no_permission"),
  };
}
