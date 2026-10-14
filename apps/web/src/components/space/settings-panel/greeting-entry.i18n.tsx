import { useTranslation } from "react-i18next";

const en = {
  section: "Space settings",
  name: "Greeting settings",
  description: "Message shown to participants while they wait for the space to start.",
  locked: "Read-only after the space has started.",
  open: "Edit",
  view: "View",
};

const ko: Record<keyof typeof en, string> = {
  section: "스페이스 설정",
  name: "인사말 설정",
  description: "스페이스 시작을 기다리는 참여자에게 보여줄 인사말입니다.",
  locked: "스페이스가 시작된 후에는 읽기 전용입니다.",
  open: "편집",
  view: "보기",
};

export const i18n = { en, ko };

export interface GreetingEntryI18n {
  section: string;
  name: string;
  description: string;
  locked: string;
  open: string;
  view: string;
}

/** Strings for the settings-panel greeting entry (namespace "greetingEntry"). */
export function useGreetingEntryI18n(): GreetingEntryI18n {
  const { t } = useTranslation("greetingEntry");
  return {
    section: t("section"),
    name: t("name"),
    description: t("description"),
    locked: t("locked"),
    open: t("open"),
    view: t("view"),
  };
}
