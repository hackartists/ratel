// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/spaces/pages/actions/actions/quiz/views/main/quiz_read_page.rs (`QuizReadTranslate`). Namespace "quizRead".
import { useTranslation } from "react-i18next";

const en = {
  btn_next: "Next",
  btn_cancel: "Cancel",
  page_title: "Quiz",
  btn_back: "Back",
  btn_submit: "Submit",
  quiz_ended: "This quiz has ended.",
  quiz_not_started: "This quiz has not started yet.",
  space_not_active: "This action is available only when the space is started or in progress.",
  submit_success: "Response submitted successfully.",
  remaining_submissions: "Remaining submissions",
  score_label: "Score",
  no_questions: "No questions yet.",
  status_pass: "PASS",
  status_failed: "FAILED",
  question_label: "Question",
  no_permission: "You do not have permission to participate in this quiz.",
  already_passed: "You have already passed this quiz.",
  no_remaining_attempts: "You have no remaining attempts for this quiz.",
};

const ko: Record<keyof typeof en, string> = {
  btn_next: "다음",
  btn_cancel: "취소",
  page_title: "퀴즈",
  btn_back: "뒤로",
  btn_submit: "제출",
  quiz_ended: "이 퀴즈가 종료되었습니다.",
  quiz_not_started: "이 퀴즈는 아직 시작되지 않았습니다.",
  space_not_active: "이 액션은 스페이스가 시작/진행중 상태일 때만 참여할 수 있습니다.",
  submit_success: "응답이 성공적으로 제출되었습니다.",
  remaining_submissions: "남은 제출 횟수",
  score_label: "점수",
  no_questions: "아직 질문이 없습니다.",
  status_pass: "PASS",
  status_failed: "FAILED",
  question_label: "질문",
  no_permission: "이 퀴즈에 참여할 권한이 없습니다.",
  already_passed: "이미 이 퀴즈를 통과했습니다.",
  no_remaining_attempts: "남은 참여 횟수가 없습니다.",
};

export const i18n = { en, ko };

export interface QuizReadI18n {
  btnNext: string;
  btnCancel: string;
  pageTitle: string;
  btnBack: string;
  btnSubmit: string;
  quizEnded: string;
  quizNotStarted: string;
  spaceNotActive: string;
  submitSuccess: string;
  remainingSubmissions: string;
  scoreLabel: string;
  noQuestions: string;
  statusPass: string;
  statusFailed: string;
  questionLabel: string;
  noPermission: string;
  alreadyPassed: string;
  noRemainingAttempts: string;
}

export function useQuizReadI18n(): QuizReadI18n {
  const { t } = useTranslation("quizRead");
  return {
    btnNext: t("btn_next"),
    btnCancel: t("btn_cancel"),
    pageTitle: t("page_title"),
    btnBack: t("btn_back"),
    btnSubmit: t("btn_submit"),
    quizEnded: t("quiz_ended"),
    quizNotStarted: t("quiz_not_started"),
    spaceNotActive: t("space_not_active"),
    submitSuccess: t("submit_success"),
    remainingSubmissions: t("remaining_submissions"),
    scoreLabel: t("score_label"),
    noQuestions: t("no_questions"),
    statusPass: t("status_pass"),
    statusFailed: t("status_failed"),
    questionLabel: t("question_label"),
    noPermission: t("no_permission"),
    alreadyPassed: t("already_passed"),
    noRemainingAttempts: t("no_remaining_attempts"),
  };
}
