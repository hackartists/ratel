import { useTranslation } from "react-i18next";

const en = {
  uninstall: "Remove",
  uninstall_confirm_title: "Remove this app?",
  uninstall_confirm_description:
    "The app will be removed from this space. Its data is kept, so installing it again restores what you had.",
  uninstall_cancel: "Cancel",
  uninstall_confirm: "Remove",
  uninstalling: "Removing...",
};

const ko: Record<keyof typeof en, string> = {
  uninstall: "제거",
  uninstall_confirm_title: "이 앱을 제거하시겠습니까?",
  uninstall_confirm_description:
    "스페이스에서 앱이 제거됩니다. 앱 데이터는 보존되므로 다시 설치하면 이전 내용이 그대로 표시됩니다.",
  uninstall_cancel: "취소",
  uninstall_confirm: "제거",
  uninstalling: "제거 중...",
};

export const i18n = { en, ko };

export interface AppsSectionI18n {
  uninstall: string;
  uninstallConfirmTitle: string;
  uninstallConfirmDescription: string;
  uninstallCancel: string;
  uninstallConfirm: string;
  uninstalling: string;
}

/** Strings for the settings-panel apps section (namespace "appsSection"). */
export function useAppsSectionI18n(): AppsSectionI18n {
  const { t } = useTranslation("appsSection");
  return {
    uninstall: t("uninstall"),
    uninstallConfirmTitle: t("uninstall_confirm_title"),
    uninstallConfirmDescription: t("uninstall_confirm_description"),
    uninstallCancel: t("uninstall_cancel"),
    uninstallConfirm: t("uninstall_confirm"),
    uninstalling: t("uninstalling"),
  };
}
