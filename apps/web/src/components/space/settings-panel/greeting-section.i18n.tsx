import { useTranslation } from "react-i18next";

const en = {
  label: "Waiting greeting",
  description: "Shown to participants who finished the prerequisites while they wait for the space to start.",
  placeholder: "Write a greeting for participants...",
  save: "Save",
  saving: "Saving...",
  saved: "Greeting saved",
  locked: "The greeting can't be changed after the space has started.",
};

const ko: Record<keyof typeof en, string> = {
  label: "대기 인사말",
  description: "사전 조건을 완료한 참여자가 스페이스 시작을 기다리는 동안 보게 되는 인사말입니다.",
  placeholder: "참여자에게 보여줄 인사말을 입력하세요...",
  save: "저장",
  saving: "저장 중...",
  saved: "인사말이 저장되었습니다",
  locked: "스페이스가 시작된 후에는 인사말을 변경할 수 없습니다.",
};

export const i18n = { en, ko };

export interface GreetingSectionI18n {
  label: string;
  description: string;
  placeholder: string;
  save: string;
  saving: string;
  saved: string;
  locked: string;
}

/** Strings for the settings-panel waiting greeting section (namespace "greetingSection"). */
export function useGreetingSectionI18n(): GreetingSectionI18n {
  const { t } = useTranslation("greetingSection");
  return {
    label: t("label"),
    description: t("description"),
    placeholder: t("placeholder"),
    save: t("save"),
    saving: t("saving"),
    saved: t("saved"),
    locked: t("locked"),
  };
}
