// Ported from: app/ratel/src/features/spaces/pages/actions/components/action_card/i18n.rs (`ActionCardTranslate`). Namespace "actionCard".
import { useTranslation } from "react-i18next";

const en = {
  action_type_quiz: "Quiz",
  action_type_poll: "Poll",
  action_type_discussion: "Discussion",
  action_type_follow: "Follow",
  action_type_meet: "Meet",
  prerequisite: "Pre",
  status_draft: "Draft",
  status_ongoing: "Ongoing",
  status_closed: "Closed",
  untitled: "Untitled",
  no_description: "No description",
  quiz_pass: "PASS",
  quiz_failed: "FAILED",
  delete_action: "Delete action",
  deleted_successfully: "Action deleted successfully.",
  locked: "Locked",
  dependencies_not_met: "Complete the required actions first to unlock.",
};

const ko: Record<keyof typeof en, string> = {
  action_type_quiz: "퀴즈",
  action_type_poll: "투표",
  action_type_discussion: "토론",
  action_type_follow: "팔로우",
  action_type_meet: "미팅",
  prerequisite: "사전",
  status_draft: "초안",
  status_ongoing: "진행 중",
  status_closed: "종료",
  untitled: "제목 없음",
  no_description: "설명 없음",
  quiz_pass: "PASS",
  quiz_failed: "FAILED",
  delete_action: "액션 삭제",
  deleted_successfully: "액션이 삭제되었습니다.",
  locked: "잠김",
  dependencies_not_met: "선행 액션을 먼저 완료해야 참여할 수 있습니다.",
};

export const i18n = { en, ko };

export interface ActionCardI18n {
  actionTypeQuiz: string;
  actionTypePoll: string;
  actionTypeDiscussion: string;
  actionTypeFollow: string;
  actionTypeMeet: string;
  prerequisite: string;
  statusDraft: string;
  statusOngoing: string;
  statusClosed: string;
  untitled: string;
  noDescription: string;
  quizPass: string;
  quizFailed: string;
  deleteAction: string;
  deletedSuccessfully: string;
  locked: string;
  dependenciesNotMet: string;
}

export function useActionCardI18n(): ActionCardI18n {
  const { t } = useTranslation("actionCard");
  return {
    actionTypeQuiz: t("action_type_quiz"),
    actionTypePoll: t("action_type_poll"),
    actionTypeDiscussion: t("action_type_discussion"),
    actionTypeFollow: t("action_type_follow"),
    actionTypeMeet: t("action_type_meet"),
    prerequisite: t("prerequisite"),
    statusDraft: t("status_draft"),
    statusOngoing: t("status_ongoing"),
    statusClosed: t("status_closed"),
    untitled: t("untitled"),
    noDescription: t("no_description"),
    quizPass: t("quiz_pass"),
    quizFailed: t("quiz_failed"),
    deleteAction: t("delete_action"),
    deletedSuccessfully: t("deleted_successfully"),
    locked: t("locked"),
    dependenciesNotMet: t("dependencies_not_met"),
  };
}
