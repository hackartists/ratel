// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/components/arena_topbar/i18n.rs (`RatelArenaTopbarTranslate`). Namespace "ratelArenaTopbar".
import { useTranslation } from "react-i18next";

const en = {
  brand_title: "Ratel",
  live_status: "Live",
  create: "Create",
  drafts: "Drafts",
  rewards: "Rewards",
  credentials: "Credentials",
  character: "Character",
  my_ai: "My AI",
  essence: "Essence",
  arcade: "Arcade",
  settings: "Settings",
  connections: "Connections",
};

const ko: Record<keyof typeof en, string> = {
  brand_title: "Ratel",
  live_status: "실시간",
  create: "생성",
  drafts: "임시저장",
  rewards: "보상",
  credentials: "자격증명",
  character: "캐릭터",
  my_ai: "마이 AI",
  essence: "Essence",
  arcade: "오락실",
  settings: "설정",
  connections: "연동",
};

export const i18n = { en, ko };

export interface RatelArenaTopbarI18n {
  brandTitle: string;
  liveStatus: string;
  create: string;
  drafts: string;
  rewards: string;
  credentials: string;
  character: string;
  myAi: string;
  essence: string;
  arcade: string;
  settings: string;
  connections: string;
}

export function useRatelArenaTopbarI18n(): RatelArenaTopbarI18n {
  const { t } = useTranslation("ratelArenaTopbar");
  return {
    brandTitle: t("brand_title"),
    liveStatus: t("live_status"),
    create: t("create"),
    drafts: t("drafts"),
    rewards: t("rewards"),
    credentials: t("credentials"),
    character: t("character"),
    myAi: t("my_ai"),
    essence: t("essence"),
    arcade: t("arcade"),
    settings: t("settings"),
    connections: t("connections"),
  };
}
