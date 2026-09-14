// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/spaces/space_common/components/space_start_modal/mod.rs (`SpaceStartModalTranslate`). Namespace "spaceStartModal".
import { useTranslation } from "react-i18next";

const en = {
  warning: "Once started, participants can begin their activities.",
  cancel: "Cancel",
  start: "Start Space",
  starting: "Starting...",
};

const ko: Record<keyof typeof en, string> = {
  warning: "스페이스를 시작하면 참여자들이 활동을 시작할 수 있습니다.",
  cancel: "취소",
  start: "시작하기",
  starting: "시작 중...",
};

export const i18n = { en, ko };

export interface SpaceStartModalI18n {
  warning: string;
  cancel: string;
  start: string;
  starting: string;
}

export function useSpaceStartModalI18n(): SpaceStartModalI18n {
  const { t } = useTranslation("spaceStartModal");
  return {
    warning: t("warning"),
    cancel: t("cancel"),
    start: t("start"),
    starting: t("starting"),
  };
}
