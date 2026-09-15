// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/spaces/pages/actions/components/action_edit_topbar/i18n.rs (`ActionEditTopbarTranslate`). Namespace "actionEditTopbar".
import { useTranslation } from "react-i18next";

const en = {
  back: "Back",
  actions_breadcrumb: "Actions",
  cancel: "Cancel",
  save_draft: "Save Draft",
  publish: "Publish",
  title_aria: "Action title",
};

const ko: Record<keyof typeof en, string> = {
  back: "뒤로",
  actions_breadcrumb: "액션",
  cancel: "취소",
  save_draft: "임시저장",
  publish: "게시",
  title_aria: "액션 제목",
};

export const i18n = { en, ko };

export interface ActionEditTopbarI18n {
  back: string;
  actionsBreadcrumb: string;
  cancel: string;
  saveDraft: string;
  publish: string;
  titleAria: string;
}

export function useActionEditTopbarI18n(): ActionEditTopbarI18n {
  const { t } = useTranslation("actionEditTopbar");
  return {
    back: t("back"),
    actionsBreadcrumb: t("actions_breadcrumb"),
    cancel: t("cancel"),
    saveDraft: t("save_draft"),
    publish: t("publish"),
    titleAria: t("title_aria"),
  };
}
