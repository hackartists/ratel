// Ported from: app/ratel/src/features/spaces/pages/actions/views/main/creator_page/i18n.rs (`CreatorActionPageTranslate`). Namespace "creatorActionPage".
import { useTranslation } from "react-i18next";

const en = {
  title: "Actions",
  title_tooltip: "You must complete all prerequisite actions before the space starts to become a participant.",
  button_settings_label: "Action Settings",
  button_add_action_label: "Select Action Type",
  no_actions_title: "Add first action",
  no_actions_description: "To create an Action you need to add",
  layover_title: "Select Action Type",
};

const ko: Record<keyof typeof en, string> = {
  title: "Actions",
  title_tooltip: "스페이스 시작 전 사전 항목들을 모두 완수해야 참여자로 전환됩니다.",
  button_settings_label: "액션 설정",
  button_add_action_label: "액션 생성",
  no_actions_title: "첫 액션을 생성해보세요",
  no_actions_description: "원하는 액션을 생성하세요",
  layover_title: "액션 유형 선택",
};

export const i18n = { en, ko };

export interface CreatorActionPageI18n {
  title: string;
  titleTooltip: string;
  buttonSettingsLabel: string;
  buttonAddActionLabel: string;
  noActionsTitle: string;
  noActionsDescription: string;
  layoverTitle: string;
}

export function useCreatorActionPageI18n(): CreatorActionPageI18n {
  const { t } = useTranslation("creatorActionPage");
  return {
    title: t("title"),
    titleTooltip: t("title_tooltip"),
    buttonSettingsLabel: t("button_settings_label"),
    buttonAddActionLabel: t("button_add_action_label"),
    noActionsTitle: t("no_actions_title"),
    noActionsDescription: t("no_actions_description"),
    layoverTitle: t("layover_title"),
  };
}
