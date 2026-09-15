// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/spaces/space_common/components/space_nav/prerequisite_actions_layover.rs (`PrerequisiteActionsLayoverTranslate`). Namespace "prerequisiteActionsLayover".
import { useTranslation } from "react-i18next";

const en = {
  title: "Required Actions",
  description: "Please complete the following actions to fully participate in this space.",
  close: "Close",
};

const ko: Record<keyof typeof en, string> = {
  title: "필수 액션",
  description: "이 스페이스에 완전히 참여하려면 다음 액션을 완료해주세요.",
  close: "닫기",
};

export const i18n = { en, ko };

export interface PrerequisiteActionsLayoverI18n {
  title: string;
  description: string;
  close: string;
}

export function usePrerequisiteActionsLayoverI18n(): PrerequisiteActionsLayoverI18n {
  const { t } = useTranslation("prerequisiteActionsLayover");
  return {
    title: t("title"),
    description: t("description"),
    close: t("close"),
  };
}
