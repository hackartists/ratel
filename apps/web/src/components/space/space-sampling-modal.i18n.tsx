/** Strings of the Open → Sampling confirmation modal. Namespace "spaceSamplingModal". */
import { useTranslation } from "react-i18next";

const en = {
  warning: "Start sampling? The settings lock, and with the random method each group is drawn right away.",
  cancel: "Cancel",
  confirm: "Start Sampling",
  busy: "Starting...",
};

const ko: Record<keyof typeof en, string> = {
  warning: "표본 추출을 시작할까요? 설정이 잠기고, 랜덤 방식이면 즉시 그룹별로 추출합니다.",
  cancel: "취소",
  confirm: "표본 추출 시작",
  busy: "시작 중...",
};

export const i18n = { en, ko };

export interface SpaceSamplingModalI18n {
  warning: string;
  cancel: string;
  confirm: string;
  busy: string;
}

export function useSpaceSamplingModalI18n(): SpaceSamplingModalI18n {
  const { t } = useTranslation("spaceSamplingModal");
  return {
    warning: t("warning"),
    cancel: t("cancel"),
    confirm: t("confirm"),
    busy: t("busy"),
  };
}
