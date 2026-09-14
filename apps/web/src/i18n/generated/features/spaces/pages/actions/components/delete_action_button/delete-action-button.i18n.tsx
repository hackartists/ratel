// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/spaces/pages/actions/components/delete_action_button/mod.rs (`DeleteActionButtonTranslate`). Namespace "deleteActionButton".
import { useTranslation } from "react-i18next";

const en = {
  delete_action: "Delete",
  delete_success: "Action deleted successfully.",
};

const ko: Record<keyof typeof en, string> = {
  delete_action: "삭제하기",
  delete_success: "액션이 삭제되었습니다.",
};

export const i18n = { en, ko };

export interface DeleteActionButtonI18n {
  deleteAction: string;
  deleteSuccess: string;
}

export function useDeleteActionButtonI18n(): DeleteActionButtonI18n {
  const { t } = useTranslation("deleteActionButton");
  return {
    deleteAction: t("delete_action"),
    deleteSuccess: t("delete_success"),
  };
}
