// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/spaces/pages/actions/actions/poll/components/survey_editor.rs (`SurveyEditorTranslate`). Namespace "surveyEditor".
import { useTranslation } from "react-i18next";

const en = {
  btn_delete: "Delete",
};

const ko: Record<keyof typeof en, string> = {
  btn_delete: "삭제하기",
};

export const i18n = { en, ko };

export interface SurveyEditorI18n {
  btnDelete: string;
}

export function useSurveyEditorI18n(): SurveyEditorI18n {
  const { t } = useTranslation("surveyEditor");
  return {
    btnDelete: t("btn_delete"),
  };
}
