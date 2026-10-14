import type { Answer, Question } from "@ratel/ts-bridges";
import { useTranslation } from "react-i18next";
import { pickedTerminationOption, terminationMessage } from "./poll-flow";

const en = {
  title: "This will end the survey",
  description:
    "Selecting '{{option}}' will end the survey immediately, and you won't be able to participate again. To continue, press 'Cancel' and choose a different option.",
  description_editable:
    "Selecting '{{option}}' will end the survey immediately. To continue, press 'Cancel' and choose a different option.",
  privacy_description:
    "Because you did not agree to a required consent item, you cannot continue with this survey. Pressing [Submit] will end the survey. If you have read the above, please press [Submit].",
  cancel: "Cancel",
  confirm: "End survey",
  submit: "Submit",
};

const ko: Record<keyof typeof en, string> = {
  title: "설문조사가 종료됩니다",
  description:
    "'{{option}}' 항목을 선택하면 설문조사가 바로 종료되고, 다시 참여할 수 없습니다. 계속 진행하려면 '취소'를 누르고 다른 항목을 선택해 주세요.",
  description_editable:
    "'{{option}}' 항목을 선택하면 설문조사가 바로 종료됩니다. 계속 진행하려면 '취소'를 누르고 다른 항목을 선택해 주세요.",
  privacy_description:
    "필수 동의 항목에 동의하지 않으셨으므로 본 설문을 계속 진행하실 수 없습니다. [제출] 버튼을 누르시면 조사가 종료됩니다. 위 내용을 확인하셨다면 [제출] 버튼을 눌러 주시기 바랍니다.",
  cancel: "취소",
  confirm: "종료하기",
  submit: "제출",
};

export const i18n = { en, ko };

/** Copy for the warning shown before a termination option ends the poll. */
export interface PollTerminationI18n {
  title: string;
  /** Body for polls whose response cannot be edited, so ending it also blocks participating again. */
  description: (values: { option: string }) => string;
  /** Body for polls with editable responses, where the participant may still come back and change the answer. */
  descriptionEditable: (values: { option: string }) => string;
  /** Default body when the participant disagrees to a privacy consent question. */
  privacyDescription: string;
  cancel: string;
  confirm: string;
  /** Confirm label for the privacy-consent case, where confirming submits the response. */
  submit: string;
}

export function usePollTerminationI18n(): PollTerminationI18n {
  const { t } = useTranslation("pollTermination");
  return {
    title: t("title"),
    description: (values) => t("description", { replace: values }),
    descriptionEditable: (values) => t("description_editable", { replace: values }),
    privacyDescription: t("privacy_description"),
    cancel: t("cancel"),
    confirm: t("confirm"),
    submit: t("submit"),
  };
}

/** What the termination confirmation shows for the answer that ended the poll. */
export interface TerminationCopy {
  description: string;
  confirmLabel: string;
  /** Styles the confirm button as destructive (red). */
  destructive: boolean;
}

/**
 * Resolves the confirmation copy for `answer` ending the poll at `question`.
 * The author's `termination_message` wins over the default copy; a declined
 * privacy consent confirms with a red "Submit" button.
 */
export function resolveTerminationCopy(
  tr: PollTerminationI18n,
  question: Question,
  answer: Answer,
  responseEditable: boolean,
): TerminationCopy {
  const custom = terminationMessage(question);
  if (question.answer_type === "privacy_consent") {
    return { description: custom ?? tr.privacyDescription, confirmLabel: tr.submit, destructive: true };
  }
  const option = pickedTerminationOption(question, answer) ?? "";
  const fallback = (responseEditable ? tr.descriptionEditable : tr.description)({ option });
  return { description: custom ?? fallback, confirmLabel: tr.confirm, destructive: false };
}
