import { useTranslation } from "react-i18next";

const en = {
  title: "This will end the survey",
  description:
    "Selecting '{{option}}' will end the survey immediately, and you won't be able to participate again. To continue, press 'Cancel' and choose a different option.",
  description_editable:
    "Selecting '{{option}}' will end the survey immediately. To continue, press 'Cancel' and choose a different option.",
  cancel: "Cancel",
  confirm: "End survey",
};

const ko: Record<keyof typeof en, string> = {
  title: "설문조사가 종료됩니다",
  description:
    "'{{option}}' 항목을 선택하면 설문조사가 바로 종료되고, 다시 참여할 수 없습니다. 계속 진행하려면 '취소'를 누르고 다른 항목을 선택해 주세요.",
  description_editable:
    "'{{option}}' 항목을 선택하면 설문조사가 바로 종료됩니다. 계속 진행하려면 '취소'를 누르고 다른 항목을 선택해 주세요.",
  cancel: "취소",
  confirm: "종료하기",
};

export const i18n = { en, ko };

/** Copy for the warning shown before a termination option ends the poll. */
export interface PollTerminationI18n {
  title: string;
  /** Body for polls whose response cannot be edited, so ending it also blocks participating again. */
  description: (values: { option: string }) => string;
  /** Body for polls with editable responses, where the participant may still come back and change the answer. */
  descriptionEditable: (values: { option: string }) => string;
  cancel: string;
  confirm: string;
}

export function usePollTerminationI18n(): PollTerminationI18n {
  const { t } = useTranslation("pollTermination");
  return {
    title: t("title"),
    description: (values) => t("description", { replace: values }),
    descriptionEditable: (values) => t("description_editable", { replace: values }),
    cancel: t("cancel"),
    confirm: t("confirm"),
  };
}
