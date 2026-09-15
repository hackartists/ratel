// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/cross_posting/i18n.rs (`ComposeSidebarTranslate`). Namespace "composeSidebar".
import { useTranslation } from "react-i18next";

const en = {
  eyebrow: "Syndication",
  title: "Cross-post",
  sub: "Publish once. Reach every network your audience lives on.",
  reaching: "Reaching",
  networks_suffix: "networks",
  not_connected: "Not connected",
  truncated_badge: "Truncated",
  connect_hint_bluesky: "Connect Bluesky to cross-post to the AT Protocol network.",
  connect_hint_linkedin: "Connect LinkedIn to reach your professional network.",
  connect_hint_threads: "Connect Threads to reach Meta's audience with every post.",
  connect_btn_bluesky: "Connect Bluesky",
  connect_btn_linkedin: "Connect LinkedIn",
  connect_btn_threads: "Connect Threads",
  coming_soon: "Coming soon",
};

const ko: Record<keyof typeof en, string> = {
  eyebrow: "확장 게시",
  title: "크로스포스트",
  sub: "한 번 발행하면 청중이 머무는 모든 네트워크에 닿습니다.",
  reaching: "도달 범위",
  networks_suffix: "개 네트워크",
  not_connected: "연결 안 됨",
  truncated_badge: "잘림",
  connect_hint_bluesky: "Bluesky 를 연결해 AT Protocol 네트워크에 크로스포스트하세요.",
  connect_hint_linkedin: "LinkedIn 을 연결해 비즈니스 네트워크에 도달하세요.",
  connect_hint_threads: "Threads 를 연결해 Meta 의 사용자에게 모든 게시물을 전달하세요.",
  connect_btn_bluesky: "Bluesky 연결",
  connect_btn_linkedin: "LinkedIn 연결",
  connect_btn_threads: "Threads 연결",
  coming_soon: "곧 출시",
};

export const i18n = { en, ko };

export interface ComposeSidebarI18n {
  eyebrow: string;
  title: string;
  sub: string;
  reaching: string;
  networksSuffix: string;
  notConnected: string;
  truncatedBadge: string;
  connectHintBluesky: string;
  connectHintLinkedin: string;
  connectHintThreads: string;
  connectBtnBluesky: string;
  connectBtnLinkedin: string;
  connectBtnThreads: string;
  comingSoon: string;
}

export function useComposeSidebarI18n(): ComposeSidebarI18n {
  const { t } = useTranslation("composeSidebar");
  return {
    eyebrow: t("eyebrow"),
    title: t("title"),
    sub: t("sub"),
    reaching: t("reaching"),
    networksSuffix: t("networks_suffix"),
    notConnected: t("not_connected"),
    truncatedBadge: t("truncated_badge"),
    connectHintBluesky: t("connect_hint_bluesky"),
    connectHintLinkedin: t("connect_hint_linkedin"),
    connectHintThreads: t("connect_hint_threads"),
    connectBtnBluesky: t("connect_btn_bluesky"),
    connectBtnLinkedin: t("connect_btn_linkedin"),
    connectBtnThreads: t("connect_btn_threads"),
    comingSoon: t("coming_soon"),
  };
}
