// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/spaces/space_common/components/space_end_modal/mod.rs (`SpaceEndModalTranslate`). Namespace "spaceEndModal".
import { useTranslation } from "react-i18next";

const en = {
  warning: "Are you sure you want to end this space?",
  cancel: "Cancel",
  end: "End Space",
  ending: "Ending...",
};

const ko: Record<keyof typeof en, string> = {
  warning: "정말로 이 스페이스를 종료하시겠습니까?",
  cancel: "취소",
  end: "종료하기",
  ending: "종료 중...",
};

export const i18n = { en, ko };

export interface SpaceEndModalI18n {
  warning: string;
  cancel: string;
  end: string;
  ending: string;
}

export function useSpaceEndModalI18n(): SpaceEndModalI18n {
  const { t } = useTranslation("spaceEndModal");
  return {
    warning: t("warning"),
    cancel: t("cancel"),
    end: t("end"),
    ending: t("ending"),
  };
}
