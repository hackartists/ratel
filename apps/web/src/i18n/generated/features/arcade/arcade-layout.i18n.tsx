// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/arcade/i18n.rs (`ArcadeLayoutTranslate`). Namespace "arcadeLayout".
import { useTranslation } from "react-i18next";

const en = {
  brand: "RATEL ARCADE",
  brand_sub: "Ratel Arcade · v1",
  tab_home: "Arcade",
  tab_leaderboard: "Leaderboard",
  chip_unit: "chips",
  chip_aria: "Open chip exchange",
  admin_create_round: "Create round",
  menu_open: "Open menu",
  menu_close: "Close menu",
  menu_nav_label: "Arcade menu",
};

const ko: Record<keyof typeof en, string> = {
  brand: "RATEL ARCADE",
  brand_sub: "라텔 오락실 · v1",
  tab_home: "오락실",
  tab_leaderboard: "리더보드",
  chip_unit: "칩",
  chip_aria: "칩 환전 열기",
  admin_create_round: "라운드 생성",
  menu_open: "메뉴 열기",
  menu_close: "메뉴 닫기",
  menu_nav_label: "아케이드 메뉴",
};

export const i18n = { en, ko };

export interface ArcadeLayoutI18n {
  brand: string;
  brandSub: string;
  tabHome: string;
  tabLeaderboard: string;
  chipUnit: string;
  chipAria: string;
  adminCreateRound: string;
  menuOpen: string;
  menuClose: string;
  menuNavLabel: string;
}

export function useArcadeLayoutI18n(): ArcadeLayoutI18n {
  const { t } = useTranslation("arcadeLayout");
  return {
    brand: t("brand"),
    brandSub: t("brand_sub"),
    tabHome: t("tab_home"),
    tabLeaderboard: t("tab_leaderboard"),
    chipUnit: t("chip_unit"),
    chipAria: t("chip_aria"),
    adminCreateRound: t("admin_create_round"),
    menuOpen: t("menu_open"),
    menuClose: t("menu_close"),
    menuNavLabel: t("menu_nav_label"),
  };
}
