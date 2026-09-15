// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/social/pages/setting/team/views/subscription_page/i18n.rs (`TeamSubscriptionTranslate`). Namespace "teamSubscription".
import { useTranslation } from "react-i18next";

const en = {
  section_label_prefix: "Choose Your",
  section_label_strong: "Tier",
  hero_title_en: "Membership Plans",
  hero_title_ko: "멤버십 플랜",
  hero_desc_prefix: "",
  hero_desc_credits: "Credits",
  hero_desc_middle: " are monthly points used to create or boost a ",
  hero_desc_reward_space: "reward space",
  hero_desc_suffix: ".",
  free_name: "Free",
  free_desc: "Basic membership open to everyone",
  free_feat_1: "Publish posts",
  free_feat_2: "Publish spaces",
  free_feat_3: "Network relationship",
  free_feat_4: "Participate in reward spaces",
  free_price_amount: "Free",
  pro_name: "Pro",
  pro_desc: "Reward Space setup for small communities",
  pro_feat_1: "Includes all Free",
  pro_feat_2_strong: "40 monthly credits",
  pro_feat_2_prefix: "",
  pro_feat_2_suffix: "",
  pro_feat_3: "Up to 2 credits per a reward space",
  pro_feat_4: "Earn 10% of the total rewards distributed to participants.",
  max_name: "Max",
  max_desc: "Advanced Reward Spaces for large communities",
  max_feat_1: "Includes all Free",
  max_feat_2_strong: "190 monthly credits",
  max_feat_2_prefix: "",
  max_feat_2_suffix: "",
  max_feat_3: "Up to 10 credits per a reward space",
  max_feat_4: "Earn 10% of the total rewards distributed to participants.",
  max_feat_5: "Get a trusted creator badge",
  vip_name: "VIP",
  vip_desc: "Reward Spaces for influencers and promotion",
  vip_feat_1: "Includes all Free",
  vip_feat_2_strong: "1,360 monthly credits",
  vip_feat_2_prefix: "",
  vip_feat_2_suffix: "",
  vip_feat_3: "Up to 100 credits per a reward space",
  vip_feat_4: "Earn 10% of the total rewards distributed to participants.",
  vip_feat_5: "Get a trusted creator badge",
  vip_feat_6: "Access raw participant data",
  vip_ribbon: "Most Popular",
  price_prefix: "₩",
  price_suffix_krw: " / month",
  cta_current: "Current Plan",
  cta_apply_pro: "Get Pro",
  cta_apply_max: "Get Max",
  cta_apply_vip: "Get VIP",
  enterprise_name: "Enterprise",
  enterprise_desc: "Customized partner plan for enterprises & organizations",
  enterprise_feat_1: "Includes all Free",
  enterprise_feat_2: "Fully customizable",
  enterprise_price: "Starting at ",
  enterprise_price_amount: "$1,000 / month",
  enterprise_cta: "Contact Us",
  footer_note: "All plans are billed monthly and can be changed or cancelled anytime. VAT excluded.",
};

const ko: Record<keyof typeof en, string> = {
  section_label_prefix: "멤버십",
  section_label_strong: "선택",
  hero_title_en: "Membership Plans",
  hero_title_ko: "멤버십 플랜",
  hero_desc_prefix: "",
  hero_desc_credits: "Credits",
  hero_desc_middle: "은 ",
  hero_desc_reward_space: "보상 스페이스",
  hero_desc_suffix: "를 생성하거나 부스팅시키는 데 사용할 수 있는 월간 포인트입니다.",
  free_name: "무료",
  free_desc: "누구나 참여 가능한 기본 멤버십",
  free_feat_1: "포스트 게재",
  free_feat_2: "스페이스 생성",
  free_feat_3: "인맥 관리",
  free_feat_4: "보상 스페이스 참여",
  free_price_amount: "Free",
  pro_name: "Pro",
  pro_desc: "소규모 커뮤니티를 위한 보상 스페이스 구축",
  pro_feat_1: "모든 무료 플랜 포함",
  pro_feat_2_strong: "월별 40 크레딧 제공",
  pro_feat_2_prefix: "",
  pro_feat_2_suffix: "",
  pro_feat_3: "보상 스페이스 또는 보상 기능별 최대 2 크레딧 사용 가능",
  pro_feat_4: "참여자 전체 보상의 10% 생성 보상 획득",
  max_name: "Max",
  max_desc: "대규모 커뮤니티를 위한 보상 스페이스 기능 제공",
  max_feat_1: "모든 무료 플랜 포함",
  max_feat_2_strong: "월별 190 크레딧 제공",
  max_feat_2_prefix: "",
  max_feat_2_suffix: "",
  max_feat_3: "보상 스페이스 또는 보상 기능별 최대 10 크레딧 사용 가능",
  max_feat_4: "참여자 전체 보상의 10% 생성 보상 획득",
  max_feat_5: "신뢰 크리에이터 배지 획득",
  vip_name: "VIP",
  vip_desc: "인플루언서 및 마케팅 전문 기업을 위한 보상 스페이스 기능 제공",
  vip_feat_1: "모든 무료 플랜 포함",
  vip_feat_2_strong: "월별 1,360 크레딧 제공",
  vip_feat_2_prefix: "",
  vip_feat_2_suffix: "",
  vip_feat_3: "보상 스페이스 또는 보상 기능별 최대 100 크레딧 사용 가능",
  vip_feat_4: "참여자 전체 보상의 10% 생성 보상 획득",
  vip_feat_5: "신뢰 크리에이터 배지 획득",
  vip_feat_6: "참여자 원본 데이터 열람",
  vip_ribbon: "Most Popular",
  price_prefix: "월 ",
  price_suffix_krw: "원",
  cta_current: "현재 플랜",
  cta_apply_pro: "Pro 신청",
  cta_apply_max: "Max 신청",
  cta_apply_vip: "VIP 신청",
  enterprise_name: "엔터프라이즈",
  enterprise_desc: "기업 및 기관 맞춤형 파트너 멤버십",
  enterprise_feat_1: "모든 무료 플랜 포함",
  enterprise_feat_2: "완전 맞춤형 서비스 제공",
  enterprise_price: "월 ",
  enterprise_price_amount: "1,000,000원 이상",
  enterprise_cta: "Contact Us",
  footer_note: "모든 플랜은 월 단위로 결제되며 언제든 변경하거나 해지할 수 있습니다. 부가세 별도.",
};

export const i18n = { en, ko };

export interface TeamSubscriptionI18n {
  sectionLabelPrefix: string;
  sectionLabelStrong: string;
  heroTitleEn: string;
  heroTitleKo: string;
  heroDescPrefix: string;
  heroDescCredits: string;
  heroDescMiddle: string;
  heroDescRewardSpace: string;
  heroDescSuffix: string;
  freeName: string;
  freeDesc: string;
  freeFeat1: string;
  freeFeat2: string;
  freeFeat3: string;
  freeFeat4: string;
  freePriceAmount: string;
  proName: string;
  proDesc: string;
  proFeat1: string;
  proFeat2Strong: string;
  proFeat2Prefix: string;
  proFeat2Suffix: string;
  proFeat3: string;
  proFeat4: string;
  maxName: string;
  maxDesc: string;
  maxFeat1: string;
  maxFeat2Strong: string;
  maxFeat2Prefix: string;
  maxFeat2Suffix: string;
  maxFeat3: string;
  maxFeat4: string;
  maxFeat5: string;
  vipName: string;
  vipDesc: string;
  vipFeat1: string;
  vipFeat2Strong: string;
  vipFeat2Prefix: string;
  vipFeat2Suffix: string;
  vipFeat3: string;
  vipFeat4: string;
  vipFeat5: string;
  vipFeat6: string;
  vipRibbon: string;
  pricePrefix: string;
  priceSuffixKrw: string;
  ctaCurrent: string;
  ctaApplyPro: string;
  ctaApplyMax: string;
  ctaApplyVip: string;
  enterpriseName: string;
  enterpriseDesc: string;
  enterpriseFeat1: string;
  enterpriseFeat2: string;
  enterprisePrice: string;
  enterprisePriceAmount: string;
  enterpriseCta: string;
  footerNote: string;
}

export function useTeamSubscriptionI18n(): TeamSubscriptionI18n {
  const { t } = useTranslation("teamSubscription");
  return {
    sectionLabelPrefix: t("section_label_prefix"),
    sectionLabelStrong: t("section_label_strong"),
    heroTitleEn: t("hero_title_en"),
    heroTitleKo: t("hero_title_ko"),
    heroDescPrefix: t("hero_desc_prefix"),
    heroDescCredits: t("hero_desc_credits"),
    heroDescMiddle: t("hero_desc_middle"),
    heroDescRewardSpace: t("hero_desc_reward_space"),
    heroDescSuffix: t("hero_desc_suffix"),
    freeName: t("free_name"),
    freeDesc: t("free_desc"),
    freeFeat1: t("free_feat_1"),
    freeFeat2: t("free_feat_2"),
    freeFeat3: t("free_feat_3"),
    freeFeat4: t("free_feat_4"),
    freePriceAmount: t("free_price_amount"),
    proName: t("pro_name"),
    proDesc: t("pro_desc"),
    proFeat1: t("pro_feat_1"),
    proFeat2Strong: t("pro_feat_2_strong"),
    proFeat2Prefix: t("pro_feat_2_prefix"),
    proFeat2Suffix: t("pro_feat_2_suffix"),
    proFeat3: t("pro_feat_3"),
    proFeat4: t("pro_feat_4"),
    maxName: t("max_name"),
    maxDesc: t("max_desc"),
    maxFeat1: t("max_feat_1"),
    maxFeat2Strong: t("max_feat_2_strong"),
    maxFeat2Prefix: t("max_feat_2_prefix"),
    maxFeat2Suffix: t("max_feat_2_suffix"),
    maxFeat3: t("max_feat_3"),
    maxFeat4: t("max_feat_4"),
    maxFeat5: t("max_feat_5"),
    vipName: t("vip_name"),
    vipDesc: t("vip_desc"),
    vipFeat1: t("vip_feat_1"),
    vipFeat2Strong: t("vip_feat_2_strong"),
    vipFeat2Prefix: t("vip_feat_2_prefix"),
    vipFeat2Suffix: t("vip_feat_2_suffix"),
    vipFeat3: t("vip_feat_3"),
    vipFeat4: t("vip_feat_4"),
    vipFeat5: t("vip_feat_5"),
    vipFeat6: t("vip_feat_6"),
    vipRibbon: t("vip_ribbon"),
    pricePrefix: t("price_prefix"),
    priceSuffixKrw: t("price_suffix_krw"),
    ctaCurrent: t("cta_current"),
    ctaApplyPro: t("cta_apply_pro"),
    ctaApplyMax: t("cta_apply_max"),
    ctaApplyVip: t("cta_apply_vip"),
    enterpriseName: t("enterprise_name"),
    enterpriseDesc: t("enterprise_desc"),
    enterpriseFeat1: t("enterprise_feat_1"),
    enterpriseFeat2: t("enterprise_feat_2"),
    enterprisePrice: t("enterprise_price"),
    enterprisePriceAmount: t("enterprise_price_amount"),
    enterpriseCta: t("enterprise_cta"),
    footerNote: t("footer_note"),
  };
}
