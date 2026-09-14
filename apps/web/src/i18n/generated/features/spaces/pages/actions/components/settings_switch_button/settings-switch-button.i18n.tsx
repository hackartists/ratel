// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/spaces/pages/actions/components/settings_switch_button/mod.rs (`SettingsSwitchButtonTranslate`). Namespace "settingsSwitchButton".
import { useTranslation } from "react-i18next";

const en = {
  settings: "Settings",
  back_to_participant: "Back",
};

const ko: Record<keyof typeof en, string> = {
  settings: "설정하기",
  back_to_participant: "참여 화면",
};

export const i18n = { en, ko };

export interface SettingsSwitchButtonI18n {
  settings: string;
  backToParticipant: string;
}

export function useSettingsSwitchButtonI18n(): SettingsSwitchButtonI18n {
  const { t } = useTranslation("settingsSwitchButton");
  return {
    settings: t("settings"),
    backToParticipant: t("back_to_participant"),
  };
}
