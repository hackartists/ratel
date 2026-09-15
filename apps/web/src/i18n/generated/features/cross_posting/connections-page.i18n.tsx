// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/cross_posting/i18n.rs (`ConnectionsPageTranslate`). Namespace "connectionsPage".
import { useTranslation } from "react-i18next";

const en = {
  title: "Connections",
  eyebrow: "Settings · Cross-posting",
  hero_eyebrow: "Cross-posting",
  hero_title: "Connect once.",
  hero_title_accent: "Reach every network.",
  hero_sub: "Each Ratel post fans out to your connected social accounts with a backlink — readers find you everywhere, but your home stays here.",
  stat_connected: "Connected",
  stat_this_month: "This month",
  section_platforms: "Networks",
  section_meta_phase1: "Phase 1 · Bluesky / LinkedIn / Threads",
  status_connected: "Connected",
  status_not_connected: "Not connected",
  status_coming_soon: "Coming soon",
  status_phase2: "Phase 2",
  bluesky_name: "Bluesky",
  bluesky_limit: "300 chars · 4 images",
  bluesky_subtitle_default: "App password flow · revocable anytime",
  linkedin_name: "LinkedIn",
  linkedin_limit: "3,000 chars · OAuth 2.0",
  linkedin_subtitle_default: "OAuth 2.0 flow · revocable anytime",
  threads_name: "Threads",
  threads_limit: "500 chars · Requires IG account",
  threads_subtitle: "Meta OAuth integration arrives in Phase 1C",
  farcaster_name: "Farcaster",
  farcaster_limit: "320 chars · Web3-native",
  farcaster_subtitle: "Frames integration + Agent posting in Phase 2",
  posts_syndicated_count_label: " posts syndicated",
  auto_post: "Auto-post new posts",
  btn_connect: "Connect",
  btn_disconnect: "Disconnect",
  btn_notify: "Notify me",
  btn_back_aria: "Back",
};

const ko: Record<keyof typeof en, string> = {
  title: "연결",
  eyebrow: "설정 · 크로스포스팅",
  hero_eyebrow: "크로스포스팅",
  hero_title: "한 번 연결하면",
  hero_title_accent: "모든 네트워크에 도달합니다.",
  hero_sub: "Ratel 에 한 번 발행하면 연결된 소셜 계정으로 자동 백링크 게시. 어디서든 발견되지만 본진은 Ratel.",
  stat_connected: "연결됨",
  stat_this_month: "이번 달",
  section_platforms: "네트워크",
  section_meta_phase1: "Phase 1 · Bluesky / LinkedIn / Threads",
  status_connected: "연결됨",
  status_not_connected: "연결 안 됨",
  status_coming_soon: "곧 출시",
  status_phase2: "Phase 2",
  bluesky_name: "Bluesky",
  bluesky_limit: "300자 · 이미지 4장",
  bluesky_subtitle_default: "앱 비밀번호 방식 · 언제든 폐기 가능",
  linkedin_name: "LinkedIn",
  linkedin_limit: "3,000자 · OAuth 2.0",
  linkedin_subtitle_default: "OAuth 2.0 방식 · 언제든 폐기 가능",
  threads_name: "Threads",
  threads_limit: "500자 · 인스타그램 프로페셔널 필요",
  threads_subtitle: "Meta OAuth 연동은 Phase 1C 에서 활성화됩니다",
  farcaster_name: "Farcaster",
  farcaster_limit: "320자 · Web3 네이티브",
  farcaster_subtitle: "Phase 2 에서 Frames + Agent 게시 지원",
  posts_syndicated_count_label: " 건 게시됨",
  auto_post: "새 글 자동 게시",
  btn_connect: "연결하기",
  btn_disconnect: "연결 해제",
  btn_notify: "출시 알림",
  btn_back_aria: "뒤로",
};

export const i18n = { en, ko };

export interface ConnectionsPageI18n {
  title: string;
  eyebrow: string;
  heroEyebrow: string;
  heroTitle: string;
  heroTitleAccent: string;
  heroSub: string;
  statConnected: string;
  statThisMonth: string;
  sectionPlatforms: string;
  sectionMetaPhase1: string;
  statusConnected: string;
  statusNotConnected: string;
  statusComingSoon: string;
  statusPhase2: string;
  blueskyName: string;
  blueskyLimit: string;
  blueskySubtitleDefault: string;
  linkedinName: string;
  linkedinLimit: string;
  linkedinSubtitleDefault: string;
  threadsName: string;
  threadsLimit: string;
  threadsSubtitle: string;
  farcasterName: string;
  farcasterLimit: string;
  farcasterSubtitle: string;
  postsSyndicatedCountLabel: string;
  autoPost: string;
  btnConnect: string;
  btnDisconnect: string;
  btnNotify: string;
  btnBackAria: string;
}

export function useConnectionsPageI18n(): ConnectionsPageI18n {
  const { t } = useTranslation("connectionsPage");
  return {
    title: t("title"),
    eyebrow: t("eyebrow"),
    heroEyebrow: t("hero_eyebrow"),
    heroTitle: t("hero_title"),
    heroTitleAccent: t("hero_title_accent"),
    heroSub: t("hero_sub"),
    statConnected: t("stat_connected"),
    statThisMonth: t("stat_this_month"),
    sectionPlatforms: t("section_platforms"),
    sectionMetaPhase1: t("section_meta_phase1"),
    statusConnected: t("status_connected"),
    statusNotConnected: t("status_not_connected"),
    statusComingSoon: t("status_coming_soon"),
    statusPhase2: t("status_phase2"),
    blueskyName: t("bluesky_name"),
    blueskyLimit: t("bluesky_limit"),
    blueskySubtitleDefault: t("bluesky_subtitle_default"),
    linkedinName: t("linkedin_name"),
    linkedinLimit: t("linkedin_limit"),
    linkedinSubtitleDefault: t("linkedin_subtitle_default"),
    threadsName: t("threads_name"),
    threadsLimit: t("threads_limit"),
    threadsSubtitle: t("threads_subtitle"),
    farcasterName: t("farcaster_name"),
    farcasterLimit: t("farcaster_limit"),
    farcasterSubtitle: t("farcaster_subtitle"),
    postsSyndicatedCountLabel: t("posts_syndicated_count_label"),
    autoPost: t("auto_post"),
    btnConnect: t("btn_connect"),
    btnDisconnect: t("btn_disconnect"),
    btnNotify: t("btn_notify"),
    btnBackAria: t("btn_back_aria"),
  };
}
