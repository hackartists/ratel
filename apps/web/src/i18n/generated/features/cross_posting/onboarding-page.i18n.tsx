// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/cross_posting/i18n.rs (`OnboardingPageTranslate`). Namespace "onboardingPage".
import { useTranslation } from "react-i18next";

const en = {
  seo_title: "Connect your networks · Ratel",
  topbar_skip: "Skip for now →",
  eyebrow: "Connect your networks · Optional",
  title_lead: "Your first post reaches",
  title_accent: "three networks instantly.",
  sub: "Connect the social accounts you want Ratel to cross-post to. Every post becomes a link back to your home, bringing new subscribers in.",
  bluesky_meta_default: "AT Protocol · 300 chars",
  bluesky_meta_connected_suffix: " — AT Protocol · 300 chars",
  linkedin_meta: "Your professional network · 3,000 chars",
  threads_meta: "Meta · ~275M users · 500 chars",
  coming_soon: "Coming soon",
  status_connected: "Connected",
  btn_connect: "Connect",
  benefit_auto_label: "Auto-sync",
  benefit_auto_hint: "Every Ratel post publishes to your connected networks in 2–3 seconds.",
  benefit_backlinks_label: "Backlinks",
  benefit_backlinks_hint: "Each cross-post links to Ratel, turning external readers into subscribers.",
  benefit_secure_label: "Secure",
  benefit_secure_hint: "KMS-encrypted tokens · revocable from the platform or Ratel anytime.",
  cta_skip: "Skip",
  cta_continue: "Continue",
  footer_note_pro_tip: "Pro tip:",
  footer_note_body: "Creators who connect 2+ networks get 3.4× more subscribers in their first 30 days.",
};

const ko: Record<keyof typeof en, string> = {
  seo_title: "네트워크 연결 · Ratel",
  topbar_skip: "나중에 →",
  eyebrow: "네트워크 연결 · 선택",
  title_lead: "첫 게시글 한 번에",
  title_accent: "세 네트워크에 도달합니다.",
  sub: "Ratel 이 자동 크로스포스팅할 소셜 계정을 연결하세요. 모든 글이 본진으로 돌아오는 백링크가 됩니다.",
  bluesky_meta_default: "AT Protocol · 300자",
  bluesky_meta_connected_suffix: " — AT Protocol · 300자",
  linkedin_meta: "전문 네트워크 · 3,000자",
  threads_meta: "Meta · 약 2.75억 명 · 500자",
  coming_soon: "곧 출시",
  status_connected: "연결됨",
  btn_connect: "연결",
  benefit_auto_label: "자동 동기화",
  benefit_auto_hint: "Ratel 글이 연결된 네트워크에 2~3초 안에 자동 발행됩니다.",
  benefit_backlinks_label: "백링크",
  benefit_backlinks_hint: "각 크로스포스트가 Ratel 백링크가 되어 외부 독자를 구독자로 전환합니다.",
  benefit_secure_label: "보안",
  benefit_secure_hint: "토큰은 KMS 암호화 · 플랫폼이나 Ratel 에서 언제든 폐기 가능.",
  cta_skip: "건너뛰기",
  cta_continue: "계속",
  footer_note_pro_tip: "팁:",
  footer_note_body: "2개 이상의 네트워크를 연결한 크리에이터는 첫 30일에 3.4배 더 많은 구독자를 얻습니다.",
};

export const i18n = { en, ko };

export interface OnboardingPageI18n {
  seoTitle: string;
  topbarSkip: string;
  eyebrow: string;
  titleLead: string;
  titleAccent: string;
  sub: string;
  blueskyMetaDefault: string;
  blueskyMetaConnectedSuffix: string;
  linkedinMeta: string;
  threadsMeta: string;
  comingSoon: string;
  statusConnected: string;
  btnConnect: string;
  benefitAutoLabel: string;
  benefitAutoHint: string;
  benefitBacklinksLabel: string;
  benefitBacklinksHint: string;
  benefitSecureLabel: string;
  benefitSecureHint: string;
  ctaSkip: string;
  ctaContinue: string;
  footerNoteProTip: string;
  footerNoteBody: string;
}

export function useOnboardingPageI18n(): OnboardingPageI18n {
  const { t } = useTranslation("onboardingPage");
  return {
    seoTitle: t("seo_title"),
    topbarSkip: t("topbar_skip"),
    eyebrow: t("eyebrow"),
    titleLead: t("title_lead"),
    titleAccent: t("title_accent"),
    sub: t("sub"),
    blueskyMetaDefault: t("bluesky_meta_default"),
    blueskyMetaConnectedSuffix: t("bluesky_meta_connected_suffix"),
    linkedinMeta: t("linkedin_meta"),
    threadsMeta: t("threads_meta"),
    comingSoon: t("coming_soon"),
    statusConnected: t("status_connected"),
    btnConnect: t("btn_connect"),
    benefitAutoLabel: t("benefit_auto_label"),
    benefitAutoHint: t("benefit_auto_hint"),
    benefitBacklinksLabel: t("benefit_backlinks_label"),
    benefitBacklinksHint: t("benefit_backlinks_hint"),
    benefitSecureLabel: t("benefit_secure_label"),
    benefitSecureHint: t("benefit_secure_hint"),
    ctaSkip: t("cta_skip"),
    ctaContinue: t("cta_continue"),
    footerNoteProTip: t("footer_note_pro_tip"),
    footerNoteBody: t("footer_note_body"),
  };
}
