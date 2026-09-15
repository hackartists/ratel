// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/spaces/pages/actions/actions/poll/components/choice_editor.rs (`ChoiceEditorTranslate`). Namespace "choiceEditor".
import { useTranslation } from "react-i18next";

const en = {
  allow_other: "Allow Other",
};

const ko: Record<keyof typeof en, string> = {
  allow_other: "기타 허용",
};

export const i18n = { en, ko };

export interface ChoiceEditorI18n {
  allowOther: string;
}

export function useChoiceEditorI18n(): ChoiceEditorI18n {
  const { t } = useTranslation("choiceEditor");
  return {
    allowOther: t("allow_other"),
  };
}
