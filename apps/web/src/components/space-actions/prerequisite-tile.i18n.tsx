// Ported from: app/ratel/src/features/spaces/pages/actions/components/prerequisite_tile/component.rs (`PrerequisiteTileTranslate`). Namespace "prerequisiteTile".
import { useTranslation } from "react-i18next";

const en = {
  title: "Space Entry Requirement",
  description: "Make this action required for joining the space",
};

const ko: Record<keyof typeof en, string> = {
  title: "스페이스 참여 조건",
  description: "이 액션을 스페이스 참여 필수 조건으로 설정",
};

export const i18n = { en, ko };

export interface PrerequisiteTileI18n {
  title: string;
  description: string;
}

export function usePrerequisiteTileI18n(): PrerequisiteTileI18n {
  const { t } = useTranslation("prerequisiteTile");
  return {
    title: t("title"),
    description: t("description"),
  };
}
