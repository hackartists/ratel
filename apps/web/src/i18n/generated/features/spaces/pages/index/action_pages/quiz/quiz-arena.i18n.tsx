// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/spaces/pages/index/action_pages/quiz/i18n.rs (`QuizArenaTranslate`). Namespace "quizArena".
import { useTranslation } from "react-i18next";

const en = {
  quiz_label: "Quiz",
  questions_label: "Questions",
  pass_score_label: "Pass Score",
  credits_label: "Credits",
  begin_quiz: "Begin Quiz",
  review_quiz: "Review Quiz",
  btn_back: "Back",
  btn_next: "Next",
  btn_submit: "Submit",
  question_of: "Question",
  of_label: "of",
  required_label: "Required",
  attempts_left: "attempts left",
  quiz_ended: "This quiz has ended.",
  quiz_not_started: "This quiz has not started yet.",
  already_passed: "You have already passed this quiz.",
  no_remaining_attempts: "You have no remaining attempts.",
  no_permission: "You do not have permission to take this quiz.",
  no_questions: "No questions yet.",
  submit_success: "Response submitted successfully.",
  single_choice_hint: "Select one answer.",
  multiple_choice_hint: "Select all that apply.",
};

const ko: Record<keyof typeof en, string> = {
  quiz_label: "퀴즈",
  questions_label: "문항",
  pass_score_label: "통과 점수",
  credits_label: "크레딧",
  begin_quiz: "퀴즈 시작",
  review_quiz: "퀴즈 확인",
  btn_back: "뒤로",
  btn_next: "다음",
  btn_submit: "제출",
  question_of: "질문",
  of_label: "/",
  required_label: "필수",
  attempts_left: "남은 시도",
  quiz_ended: "이 퀴즈가 종료되었습니다.",
  quiz_not_started: "이 퀴즈는 아직 시작되지 않았습니다.",
  already_passed: "이미 이 퀴즈를 통과했습니다.",
  no_remaining_attempts: "남은 시도 횟수가 없습니다.",
  no_permission: "이 퀴즈에 참여할 권한이 없습니다.",
  no_questions: "아직 질문이 없습니다.",
  submit_success: "응답이 성공적으로 제출되었습니다.",
  single_choice_hint: "하나의 답을 선택하세요.",
  multiple_choice_hint: "해당하는 답을 모두 선택하세요.",
};

export const i18n = { en, ko };

export interface QuizArenaI18n {
  quizLabel: string;
  questionsLabel: string;
  passScoreLabel: string;
  creditsLabel: string;
  beginQuiz: string;
  reviewQuiz: string;
  btnBack: string;
  btnNext: string;
  btnSubmit: string;
  questionOf: string;
  ofLabel: string;
  requiredLabel: string;
  attemptsLeft: string;
  quizEnded: string;
  quizNotStarted: string;
  alreadyPassed: string;
  noRemainingAttempts: string;
  noPermission: string;
  noQuestions: string;
  submitSuccess: string;
  singleChoiceHint: string;
  multipleChoiceHint: string;
}

export function useQuizArenaI18n(): QuizArenaI18n {
  const { t } = useTranslation("quizArena");
  return {
    quizLabel: t("quiz_label"),
    questionsLabel: t("questions_label"),
    passScoreLabel: t("pass_score_label"),
    creditsLabel: t("credits_label"),
    beginQuiz: t("begin_quiz"),
    reviewQuiz: t("review_quiz"),
    btnBack: t("btn_back"),
    btnNext: t("btn_next"),
    btnSubmit: t("btn_submit"),
    questionOf: t("question_of"),
    ofLabel: t("of_label"),
    requiredLabel: t("required_label"),
    attemptsLeft: t("attempts_left"),
    quizEnded: t("quiz_ended"),
    quizNotStarted: t("quiz_not_started"),
    alreadyPassed: t("already_passed"),
    noRemainingAttempts: t("no_remaining_attempts"),
    noPermission: t("no_permission"),
    noQuestions: t("no_questions"),
    submitSuccess: t("submit_success"),
    singleChoiceHint: t("single_choice_hint"),
    multipleChoiceHint: t("multiple_choice_hint"),
  };
}
