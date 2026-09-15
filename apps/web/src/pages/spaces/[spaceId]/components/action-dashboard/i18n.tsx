// Ported from: app/ratel/src/features/spaces/pages/index/action_dashboard/locked_dependencies_popup/component.rs (`LockedDependenciesPopupTranslate`). Namespace "lockedDependenciesPopup".
import { useTranslation } from "react-i18next";

const en = {
  title: "Complete these first",
  subtitle: "Finish the actions below to unlock this one.",
  scroll_failed: "Could not locate that action on the dashboard.",
};

const ko: Record<keyof typeof en, string> = {
  title: "먼저 완료해 주세요",
  subtitle: "아래 액션을 완료해야 이 액션이 열립니다.",
  scroll_failed: "대시보드에서 해당 액션을 찾을 수 없습니다.",
};

export const i18n = { en, ko };

export interface LockedDependenciesPopupI18n {
  title: string;
  subtitle: string;
  scrollFailed: string;
}

export function useLockedDependenciesPopupI18n(): LockedDependenciesPopupI18n {
  const { t } = useTranslation("lockedDependenciesPopup");
  return {
    title: t("title"),
    subtitle: t("subtitle"),
    scrollFailed: t("scroll_failed"),
  };
}
