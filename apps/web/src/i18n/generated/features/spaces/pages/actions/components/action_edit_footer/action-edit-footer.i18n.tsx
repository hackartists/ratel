// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/spaces/pages/actions/components/action_edit_footer/i18n.rs (`ActionEditFooterTranslate`). Namespace "actionEditFooter".
import { useTranslation } from "react-i18next";

const en = {
  previous: "Previous",
  next: "Next",
  save: "Save",
  save_toast: "Saved",
  pages_aria: "Page progress",
};

const ko: Record<keyof typeof en, string> = {
  previous: "이전",
  next: "다음",
  save: "저장",
  save_toast: "저장됨",
  pages_aria: "페이지 진행",
};

export const i18n = { en, ko };

export interface ActionEditFooterI18n {
  previous: string;
  next: string;
  save: string;
  saveToast: string;
  pagesAria: string;
}

export function useActionEditFooterI18n(): ActionEditFooterI18n {
  const { t } = useTranslation("actionEditFooter");
  return {
    previous: t("previous"),
    next: t("next"),
    save: t("save"),
    saveToast: t("save_toast"),
    pagesAria: t("pages_aria"),
  };
}
