// Ported from: app/ratel/src/features/spaces/pages/actions/actions/quiz/views/main/creator/i18n.rs (`QuizCreatorTranslate`). Namespace "quizCreator".
import { useTranslation } from "react-i18next";

const en = {
  page_title: "Quiz",
  btn_edit: "Edit",
  btn_save: "Save",
  saving: "Saving...",
  all_changes_saved: "All changes saved",
  unsaved_changes: "Unsaved changes",
  btn_cancel: "Cancel",
  btn_back: "Back",
  btn_next: "Next",
  btn_done: "Done",
  no_questions: "No questions added yet.",
  title_label: "Title",
  title_placeholder: "Enter quiz title...",
  description_label: "Description",
  description_placeholder: "Enter quiz description...",
  retry_label: "Retry Count",
  survey_time_label: "Survey Time",
  retry_placeholder: "Enter retry count...",
  pass_score_label: "Pass Score",
  pass_score_placeholder: "Enter pass score...",
  overview_title: "Overview",
  overview_description: "Configure the quiz title and introduction shown before participants start.",
  upload_title: "Upload",
  upload_description: "Upload quiz reference files for participants.",
  upload_placeholder: "Upload section UI will be added here.",
  upload_drop_title: "Drag & Drop files here",
  upload_cta: "Upload",
  upload_supported_types: "PDF, DOCX, PPTX, XLSX, PNG, JPG, MP4, MOV 100MB",
  upload_empty: "No uploaded files yet.",
  upload_view: "View",
  upload_delete: "Delete",
  quiz_section_title: "Quiz",
  quiz_section_description: "Create and manage quiz questions.",
  setting_section_title: "Setting",
  setting_section_description: "Manage schedule and scoring rules.",
  type_badge_label: "Quiz",
  footer_status: "All changes saved",
  autosave_saving: "Saving...",
  autosave_saved: "Saved",
  autosave_unsaved: "Unsaved",
  card_content_title: "Content",
  card_content_subtitle: "Description, tags, and scoring rules",
  card_questions_title: "Questions",
  card_questions_subtitle: "Add, reorder, and configure quiz questions",
  card_config_title: "Configuration",
  card_config_subtitle: "Schedule, rewards, and danger zone",
  section_content_label: "Content",
  section_content_hint: "Markdown supported",
  section_scoring_label: "Scoring",
  section_attachments_label: "Attachments",
  section_attachments_hint: "Reference materials for participants",
  dropzone_title: "Drop files or click to browse",
  dropzone_sub: "PDF, PNG, JPG · max 25MB each",
  remove_file: "Remove file",
  section_questions_label: "Questions",
  section_questions_hint: "Min 3 · Max 20",
  section_schedule_label: "Schedule",
  section_participation_label: "Participation & Rewards",
  section_dependencies_label: "Dependency Actions",
  section_status_label: "Status",
  section_danger_label: "Danger zone",
  retries_suffix: "retries",
  retry_count_label: "Retry count",
  questions_suffix: "questions",
  qtype_single: "Single",
  qtype_multi: "Multi",
  remove_question: "Remove question",
  add_question: "Add question",
  add_option: "Add option",
  remove_option: "Remove option",
  schedule_starts_at: "Starts at",
  schedule_ends_at: "Ends at",
  tile_reward: "Reward (CR)",
  delete_quiz_title: "Delete this quiz",
  delete_quiz_desc: "Removes the quiz and all submissions. Rewards already paid are not refunded.",
  delete_quiz_btn: "Delete quiz",
  next_questions: "Next: Questions",
  next_configuration: "Next: Configuration",
  back_questions: "Back: Questions",
  card_index_1: "01 / 03",
  card_index_2: "02 / 03",
  card_index_3: "03 / 03",
};

const ko: Record<keyof typeof en, string> = {
  page_title: "퀴즈",
  btn_edit: "편집",
  btn_save: "저장",
  saving: "저장 중...",
  all_changes_saved: "모든 변경사항 저장됨",
  unsaved_changes: "저장되지 않은 변경사항",
  btn_cancel: "취소",
  btn_back: "뒤로",
  btn_next: "다음",
  btn_done: "완료",
  no_questions: "아직 질문이 없습니다.",
  title_label: "제목",
  title_placeholder: "퀴즈 제목을 입력하세요...",
  description_label: "설명",
  description_placeholder: "퀴즈 설명을 입력하세요...",
  retry_label: "재시도 횟수",
  survey_time_label: "설문 시간",
  retry_placeholder: "재시도 횟수를 입력하세요...",
  pass_score_label: "통과 기준 점수",
  pass_score_placeholder: "통과 기준 점수를 입력하세요...",
  overview_title: "개요",
  overview_description: "참여 전에 보이는 퀴즈 제목과 소개를 설정합니다.",
  upload_title: "업로드",
  upload_description: "참여자가 참고할 퀴즈 파일을 업로드합니다.",
  upload_placeholder: "업로드 섹션 UI가 여기에 추가됩니다.",
  upload_drop_title: "여기에 파일을 드래그 앤 드롭하세요",
  upload_cta: "업로드",
  upload_supported_types: "PDF, DOCX, PPTX, XLSX, PNG, JPG, MP4, MOV 100MB",
  upload_empty: "아직 업로드된 파일이 없습니다.",
  upload_view: "보기",
  upload_delete: "삭제",
  quiz_section_title: "퀴즈",
  quiz_section_description: "퀴즈 문항을 만들고 관리합니다.",
  setting_section_title: "설정",
  setting_section_description: "일정과 점수 규칙을 관리합니다.",
  type_badge_label: "퀴즈",
  footer_status: "모든 변경사항 저장됨",
  autosave_saving: "저장 중...",
  autosave_saved: "저장됨",
  autosave_unsaved: "저장 안됨",
  card_content_title: "내용",
  card_content_subtitle: "설명, 태그, 채점 규칙",
  card_questions_title: "질문",
  card_questions_subtitle: "퀴즈 질문 추가, 정렬, 구성",
  card_config_title: "설정",
  card_config_subtitle: "일정, 보상, 위험 영역",
  section_content_label: "내용",
  section_content_hint: "Markdown 지원",
  section_scoring_label: "채점",
  section_attachments_label: "첨부 파일",
  section_attachments_hint: "참가자에게 보여줄 참고 자료",
  dropzone_title: "파일을 드래그하거나 클릭하여 찾기",
  dropzone_sub: "PDF, PNG, JPG · 각 25MB까지",
  remove_file: "파일 삭제",
  section_questions_label: "질문",
  section_questions_hint: "최소 3 · 최대 20",
  section_schedule_label: "일정",
  section_participation_label: "참여 및 보상",
  section_dependencies_label: "선행 액션",
  section_status_label: "상태",
  section_danger_label: "위험 영역",
  retries_suffix: "회 재시도",
  retry_count_label: "재시도 횟수",
  questions_suffix: "문항",
  qtype_single: "단일",
  qtype_multi: "다중",
  remove_question: "질문 삭제",
  add_question: "질문 추가",
  add_option: "선지 추가",
  remove_option: "선지 삭제",
  schedule_starts_at: "시작",
  schedule_ends_at: "종료",
  tile_reward: "보상 (CR)",
  delete_quiz_title: "퀴즈 삭제",
  delete_quiz_desc: "퀴즈와 모든 제출물을 삭제합니다. 이미 지급된 보상은 환불되지 않습니다.",
  delete_quiz_btn: "퀴즈 삭제",
  next_questions: "다음: 질문",
  next_configuration: "다음: 설정",
  back_questions: "이전: 질문",
  card_index_1: "01 / 03",
  card_index_2: "02 / 03",
  card_index_3: "03 / 03",
};

export const i18n = { en, ko };

export interface QuizCreatorI18n {
  pageTitle: string;
  btnEdit: string;
  btnSave: string;
  saving: string;
  allChangesSaved: string;
  unsavedChanges: string;
  btnCancel: string;
  btnBack: string;
  btnNext: string;
  btnDone: string;
  noQuestions: string;
  titleLabel: string;
  titlePlaceholder: string;
  descriptionLabel: string;
  descriptionPlaceholder: string;
  retryLabel: string;
  surveyTimeLabel: string;
  retryPlaceholder: string;
  passScoreLabel: string;
  passScorePlaceholder: string;
  overviewTitle: string;
  overviewDescription: string;
  uploadTitle: string;
  uploadDescription: string;
  uploadPlaceholder: string;
  uploadDropTitle: string;
  uploadCta: string;
  uploadSupportedTypes: string;
  uploadEmpty: string;
  uploadView: string;
  uploadDelete: string;
  quizSectionTitle: string;
  quizSectionDescription: string;
  settingSectionTitle: string;
  settingSectionDescription: string;
  typeBadgeLabel: string;
  footerStatus: string;
  autosaveSaving: string;
  autosaveSaved: string;
  autosaveUnsaved: string;
  cardContentTitle: string;
  cardContentSubtitle: string;
  cardQuestionsTitle: string;
  cardQuestionsSubtitle: string;
  cardConfigTitle: string;
  cardConfigSubtitle: string;
  sectionContentLabel: string;
  sectionContentHint: string;
  sectionScoringLabel: string;
  sectionAttachmentsLabel: string;
  sectionAttachmentsHint: string;
  dropzoneTitle: string;
  dropzoneSub: string;
  removeFile: string;
  sectionQuestionsLabel: string;
  sectionQuestionsHint: string;
  sectionScheduleLabel: string;
  sectionParticipationLabel: string;
  sectionDependenciesLabel: string;
  sectionStatusLabel: string;
  sectionDangerLabel: string;
  retriesSuffix: string;
  retryCountLabel: string;
  questionsSuffix: string;
  qtypeSingle: string;
  qtypeMulti: string;
  removeQuestion: string;
  addQuestion: string;
  addOption: string;
  removeOption: string;
  scheduleStartsAt: string;
  scheduleEndsAt: string;
  tileReward: string;
  deleteQuizTitle: string;
  deleteQuizDesc: string;
  deleteQuizBtn: string;
  nextQuestions: string;
  nextConfiguration: string;
  backQuestions: string;
  cardIndex1: string;
  cardIndex2: string;
  cardIndex3: string;
}

export function useQuizCreatorI18n(): QuizCreatorI18n {
  const { t } = useTranslation("quizCreator");
  return {
    pageTitle: t("page_title"),
    btnEdit: t("btn_edit"),
    btnSave: t("btn_save"),
    saving: t("saving"),
    allChangesSaved: t("all_changes_saved"),
    unsavedChanges: t("unsaved_changes"),
    btnCancel: t("btn_cancel"),
    btnBack: t("btn_back"),
    btnNext: t("btn_next"),
    btnDone: t("btn_done"),
    noQuestions: t("no_questions"),
    titleLabel: t("title_label"),
    titlePlaceholder: t("title_placeholder"),
    descriptionLabel: t("description_label"),
    descriptionPlaceholder: t("description_placeholder"),
    retryLabel: t("retry_label"),
    surveyTimeLabel: t("survey_time_label"),
    retryPlaceholder: t("retry_placeholder"),
    passScoreLabel: t("pass_score_label"),
    passScorePlaceholder: t("pass_score_placeholder"),
    overviewTitle: t("overview_title"),
    overviewDescription: t("overview_description"),
    uploadTitle: t("upload_title"),
    uploadDescription: t("upload_description"),
    uploadPlaceholder: t("upload_placeholder"),
    uploadDropTitle: t("upload_drop_title"),
    uploadCta: t("upload_cta"),
    uploadSupportedTypes: t("upload_supported_types"),
    uploadEmpty: t("upload_empty"),
    uploadView: t("upload_view"),
    uploadDelete: t("upload_delete"),
    quizSectionTitle: t("quiz_section_title"),
    quizSectionDescription: t("quiz_section_description"),
    settingSectionTitle: t("setting_section_title"),
    settingSectionDescription: t("setting_section_description"),
    typeBadgeLabel: t("type_badge_label"),
    footerStatus: t("footer_status"),
    autosaveSaving: t("autosave_saving"),
    autosaveSaved: t("autosave_saved"),
    autosaveUnsaved: t("autosave_unsaved"),
    cardContentTitle: t("card_content_title"),
    cardContentSubtitle: t("card_content_subtitle"),
    cardQuestionsTitle: t("card_questions_title"),
    cardQuestionsSubtitle: t("card_questions_subtitle"),
    cardConfigTitle: t("card_config_title"),
    cardConfigSubtitle: t("card_config_subtitle"),
    sectionContentLabel: t("section_content_label"),
    sectionContentHint: t("section_content_hint"),
    sectionScoringLabel: t("section_scoring_label"),
    sectionAttachmentsLabel: t("section_attachments_label"),
    sectionAttachmentsHint: t("section_attachments_hint"),
    dropzoneTitle: t("dropzone_title"),
    dropzoneSub: t("dropzone_sub"),
    removeFile: t("remove_file"),
    sectionQuestionsLabel: t("section_questions_label"),
    sectionQuestionsHint: t("section_questions_hint"),
    sectionScheduleLabel: t("section_schedule_label"),
    sectionParticipationLabel: t("section_participation_label"),
    sectionDependenciesLabel: t("section_dependencies_label"),
    sectionStatusLabel: t("section_status_label"),
    sectionDangerLabel: t("section_danger_label"),
    retriesSuffix: t("retries_suffix"),
    retryCountLabel: t("retry_count_label"),
    questionsSuffix: t("questions_suffix"),
    qtypeSingle: t("qtype_single"),
    qtypeMulti: t("qtype_multi"),
    removeQuestion: t("remove_question"),
    addQuestion: t("add_question"),
    addOption: t("add_option"),
    removeOption: t("remove_option"),
    scheduleStartsAt: t("schedule_starts_at"),
    scheduleEndsAt: t("schedule_ends_at"),
    tileReward: t("tile_reward"),
    deleteQuizTitle: t("delete_quiz_title"),
    deleteQuizDesc: t("delete_quiz_desc"),
    deleteQuizBtn: t("delete_quiz_btn"),
    nextQuestions: t("next_questions"),
    nextConfiguration: t("next_configuration"),
    backQuestions: t("back_questions"),
    cardIndex1: t("card_index_1"),
    cardIndex2: t("card_index_2"),
    cardIndex3: t("card_index_3"),
  };
}
