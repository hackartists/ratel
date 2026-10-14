// Ported from: app/ratel/src/features/spaces/pages/apps/apps/analyzes/i18n.rs (`SpaceAnalyzesAppTranslate`). Namespace "spaceAnalyzesApp".
import { useTranslation } from "react-i18next";

const en = {
  page_title: "Poll Analyze",
  poll_section_title: "Poll Analyze",
  discussion_section_title: "Discussion Analyze",
  sample_survey: "Sample Survey",
  final_survey: "Final Survey",
  questions: "questions",
  view_analyze: "View Analyze",
  more: "More",
  no_polls: "No polls",
  no_discussions: "No discussions",
  to_be_continue: "To Be Continue",
  untitled_discussion: "Untitled Discussion",
  back_to_list: "Back to Polls",
  download_excel: "Download Excel",
  download_started: "Download started",
  responses_count: "Responses",
  remaining_days: "Remaining",
  survey_period: "Survey Period",
  filter_label: "Filter",
  filter_group_label: "Filter Category",
  filter_value_label: "Filter Value",
  filter_all: "All",
  filter_gender: "Gender",
  filter_age: "Age",
  filter_school: "School",
  gender_male: "Male",
  gender_female: "Female",
  gender_unknown: "Unknown",
  total_questions: "Questions",
  total_response_count_unit: "responses",
  no_text_responses: "No text responses",
  other_label: "Other",
  consent_agreed_label: "Agreed",
  consent_declined_label: "Did not agree",
  id: "ID",
  attribute: "Attribute",
  category: "Category",
  type_: "Type",
  questionnaire: "Questionnaire",
  question: "Question",
  answer: "Answer",
  university: "University",
  arena_breadcrumb_apps: "Apps",
  arena_breadcrumb_current: "Analyze",
  arena_topbar_title: "Analyze Results",
  list_heading: "Result Analysis",
  list_count_unit: "analyses",
  list_hint: "Use the arrows to flip through analyses, click a card to open it. The first \"+\" card creates a new analysis.",
  new_analysis_title: "Create new analysis",
  new_analysis_desc: "Pick cross filters to build a new report",
  status_finish: "Analysis complete",
  status_in_progress: "Running",
  status_failed: "Failed",
  chips_empty: "No filters · all data",
  list_card_pending_toast: "Analysis is still running. Please try again once it's complete.",
  arrow_prev_label: "Previous card",
  arrow_next_label: "Next card",
  dot_new_label: "Create new analysis",
  dot_report_label_prefix: "Report",
  detail_sidebar_label: "Analyzes",
  detail_active_filters_label: "Selected cross filters",
  detail_active_filters_empty: "No filters — all data",
  detail_meta_filter_count: "filters",
  detail_meta_filter_count_unit: "items",
  detail_meta_created_prefix: "created",
  detail_panel_chip_poll: "Poll",
  detail_panel_chip_quiz: "Quiz",
  detail_panel_chip_discussion: "Discussion",
  detail_panel_chip_follow: "Follow",
  detail_group_poll: "Poll",
  detail_group_quiz: "Quiz",
  detail_group_discussion: "Discussion",
  detail_group_follow: "Follow",
  detail_filter_all: "All",
  detail_filter_gender: "Gender",
  detail_filter_age: "Age",
  detail_filter_school: "School",
  detail_download_btn: "Download responses",
  detail_download_poll_testid_label: "Download poll responses",
  detail_responses_unit: "responses",
  detail_attempts_unit: "attempts",
  detail_correct_rate_prefix: "Correct rate",
  detail_correct_label: "Correct",
  detail_card_hint_poll: "Click an option to narrow other panels by that respondent set · multi-select",
  detail_card_hint_quiz: "Click an answer to narrow other panels by those test-takers · multi-select",
  detail_poll_card1_title: "Which area of constitutional reform is the most urgent?",
  detail_poll_card2_title: "What value should be most central to constitutional reform?",
  detail_poll_card3_title: "Free-text: things to consider during reform",
  detail_poll_title: "Do you think the Korean Constitution needs to be amended?",
  detail_quiz_title: "Constitutional Basics Quiz",
  detail_quiz_card1_title: "How many justices are on the Constitutional Court?",
  detail_quiz_card2_title: "Where does legislative power reside in Korea?",
  detail_quiz_card3_title: "What does Article 1 of the Constitution say?",
  detail_discussion_title: "What do you think about the proposed non-consent rape law?",
  detail_discussion_settings_title: "Analysis settings",
  detail_discussion_topic_modeling_label: "Topic Modeling",
  detail_discussion_lda_label: "LDA topic count",
  detail_discussion_lda_hint: "Enter a value between 1 and 20.",
  detail_discussion_tfidf_label: "TF-IDF keyword count",
  detail_discussion_network_label: "Top network nodes",
  detail_discussion_network_hint: "Enter a value between 1 and 30.",
  detail_discussion_excluded_label: "Excluded topics",
  detail_discussion_excluded_placeholder: "e.g. it, that",
  detail_discussion_excluded_hint: "Comma-separated.",
  detail_discussion_btn_reset: "Reset",
  detail_discussion_btn_apply: "Apply",
  detail_tfidf_card_title: "TF-IDF keywords",
  detail_tfidf_card_count: "Score",
  detail_lda_card_title: "LDA topic modeling",
  detail_lda_edit_label: "Edit topic labels",
  detail_lda_col_topic: "Topic",
  detail_lda_col_keywords: "Keywords",
  detail_lda_col_filter: "Filter",
  detail_lda_filter_aria_prefix: "Toggle filter for",
  detail_network_card_title: "Text network",
  detail_network_card_count: "Co-occurrence",
  detail_network_aria: "Text network",
  detail_follow_title: "Legal Expert Follow Campaign",
  detail_follow_card_title: "Completion rate by follow target",
  detail_follow_count_text: "42 participants · 12 targets",
  detail_follow_legend_done: "Completed",
  detail_follow_legend_miss: "Not completed",
  detail_back_btn_aria: "Back",
  detail_records_btn: "View raw data",
  records_page_title: "Raw records",
  records_page_hint: "Frozen at report-save time. Click a chip to filter.",
  records_empty: "No matched records for this filter.",
  records_col_user: "User",
  records_col_question: "Question",
  records_col_answer: "Answer",
  records_col_post_title: "Post",
  records_col_comment: "Comment",
  records_col_target: "Followed",
  records_load_more: "Load more",
  create_preview_records_label: "Sample raw data",
  create_preview_records_limit_hint: "Preview shows up to 50 records per filter.",
  create_preview_records_empty: "No matched records yet — press Next to load.",
  detail_sb_item_meta_questions: "questions",
  detail_sb_item_meta_responses: "responses",
  detail_sb_item_meta_attempts: "attempts",
  detail_sb_item_meta_comments: "comments",
  detail_sb_item_meta_participants: "participants",
  detail_sb_item_meta_targets: "targets",
  detail_sb_item_meta_options: "options",
  detail_sb_item_meta_correct: "correct",
  detail_sb_item_meta_followers: "followers",
  detail_panel_empty_title: "No data yet",
  detail_panel_empty_poll: "Matched respondents haven't answered any poll questions yet.",
  detail_panel_empty_quiz: "Matched respondents haven't attempted any quizzes yet.",
  detail_panel_empty_follow: "No follow targets are followed by the matched respondents yet.",
  detail_panel_empty_text_answers: "No text responses recorded.",
  detail_discussion_pick_title: "Pick a discussion",
  detail_discussion_pick_hint: "Choose a discussion in the sidebar to configure and run the text analysis pipeline.",
  detail_discussion_no_run_title: "Not analysed yet",
  detail_discussion_no_run_hint: "Set the parameters above and press 확인 to run the LDA / TF-IDF / network analysis.",
  detail_discussion_running_title: "Analysis in progress",
  detail_discussion_running_hint: "The analysis pipeline is running. This page will refresh once results are ready.",
  detail_discussion_failed_title: "Analysis failed",
  detail_discussion_failed_hint: "Something went wrong while running the analysis. Adjust the parameters and try again.",
  detail_tfidf_card_count_suffix: " terms",
  detail_lda_card_count_suffix: " topics",
  detail_network_card_count_suffix: " nodes",
  detail_network_card_edge_suffix: " edges",
  create_topbar_title: "New analysis",
  create_cf_title: "Cross filter",
  create_cf_hint: "Pick the data conditions for this analysis. Leaving it empty analyses the whole dataset.",
  create_cf_chips_all: "All",
  create_cf_add_filter: "Add filter",
  create_cf_pick_action_label: "Which action's data should we add?",
  create_cf_pick_action_cancel: "Cancel",
  create_cf_pick_item_label: "Pick one item to analyze",
  create_cf_pick_item_label_with_type: "— pick one item",
  create_cf_back_to_action: "← Pick action again",
  create_cf_remove_filter_aria: "Remove filter",
  create_action_tile_poll: "Poll",
  create_action_tile_quiz: "Quiz",
  create_action_tile_discussion: "Discussion",
  create_action_tile_follow: "Follow",
  create_action_count_unit: "items",
  create_action_questions_unit: "questions",
  create_sunji_follow_title: "Follow targets",
  create_sunji_follow_empty: "No follow targets registered",
  create_sunji_back: "← Pick again",
  create_sunji_default_title: "Selected item",
  create_sunji_confirm: "Confirm",
  create_sunji_empty: "This item has no options to pick.",
  create_sunji_loading: "Loading questions…",
  create_sunji_correct_badge: "Correct",
  create_keyword_block_title: "Keyword input (comma-separated)",
  create_keyword_input_placeholder: "e.g. evidence, statement, victim",
  create_keyword_hint: "Each keyword becomes its own filter.",
  create_preview_title: "Preview",
  create_preview_hint: "The report below will be generated with these settings. Enter a name and press \"Generate report\".",
  create_preview_name_label: "Analysis name",
  create_preview_name_placeholder: "e.g. Constitutional reform × false-accusation perception cross-analysis",
  create_preview_name_hint: "Used as the result page heading and the list-card title.",
  create_preview_chips_label: "Selected cross filters",
  create_preview_stat_respondents: "Matching respondents",
  create_preview_stat_records: "Matching records",
  create_preview_correct_tag: "Correct",
  create_pager_prev: "← Prev",
  create_pager_next: "Next →",
  create_footer_step_label_create: "1 / 2",
  create_footer_step_label_preview: "2 / 2",
  create_footer_cancel: "Cancel",
  create_footer_next: "Next →",
  create_footer_back: "← Back",
  create_footer_confirm: "Generate report",
};

const ko: Record<keyof typeof en, string> = {
  page_title: "설문 분석",
  poll_section_title: "설문 분석",
  discussion_section_title: "토론 분석",
  sample_survey: "사전 조사",
  final_survey: "최종 설문",
  questions: "문항",
  view_analyze: "분석 보기",
  more: "더보기",
  no_polls: "설문이 없습니다",
  no_discussions: "토론이 없습니다",
  to_be_continue: "To Be Continue",
  untitled_discussion: "제목 없는 토론",
  back_to_list: "설문 목록으로",
  download_excel: "엑셀 다운로드",
  download_started: "다운로드를 시작했습니다",
  responses_count: "참여자",
  remaining_days: "남은 일시",
  survey_period: "설문 기간",
  filter_label: "필터",
  filter_group_label: "필터 항목",
  filter_value_label: "필터 값",
  filter_all: "전체",
  filter_gender: "성별",
  filter_age: "연령",
  filter_school: "학교",
  gender_male: "남성",
  gender_female: "여성",
  gender_unknown: "알 수 없음",
  total_questions: "문항 수",
  total_response_count_unit: "명 응답",
  no_text_responses: "주관식 응답이 없습니다",
  other_label: "기타",
  consent_agreed_label: "동의함",
  consent_declined_label: "동의하지 않음",
  id: "ID",
  attribute: "속성",
  category: "조사구분",
  type_: "유형",
  questionnaire: "질문지",
  question: "질문",
  answer: "답변",
  university: "학교",
  arena_breadcrumb_apps: "Apps",
  arena_breadcrumb_current: "Analyze",
  arena_topbar_title: "분석 결과",
  list_heading: "결과 분석",
  list_count_unit: "개 분석",
  list_hint: "좌우 화살표로 분석을 넘기고, 카드를 클릭해 열어보세요. 첫 카드의 \"+\"는 새 분석 만들기.",
  new_analysis_title: "새 분석 만들기",
  new_analysis_desc: "교차 필터를 선택해 새 보고서를 만듭니다",
  status_finish: "분석 완료",
  status_in_progress: "분석 중",
  status_failed: "실패",
  chips_empty: "필터 없음 · 전체 데이터",
  list_card_pending_toast: "분석이 진행 중입니다. 완료된 뒤 다시 시도해주세요.",
  arrow_prev_label: "이전 카드",
  arrow_next_label: "다음 카드",
  dot_new_label: "새 분석 만들기",
  dot_report_label_prefix: "보고서",
  detail_sidebar_label: "Analyzes",
  detail_active_filters_label: "선택된 교차 필터",
  detail_active_filters_empty: "필터 없음 — 전체 데이터",
  detail_meta_filter_count: "필터",
  detail_meta_filter_count_unit: "개",
  detail_meta_created_prefix: "생성",
  detail_panel_chip_poll: "Poll",
  detail_panel_chip_quiz: "Quiz",
  detail_panel_chip_discussion: "Discussion",
  detail_panel_chip_follow: "Follow",
  detail_group_poll: "Poll",
  detail_group_quiz: "Quiz",
  detail_group_discussion: "Discussion",
  detail_group_follow: "Follow",
  detail_filter_all: "전체",
  detail_filter_gender: "성별",
  detail_filter_age: "나이",
  detail_filter_school: "학교",
  detail_download_btn: "응답 다운로드",
  detail_download_poll_testid_label: "설문 응답 다운로드",
  detail_responses_unit: "응답",
  detail_attempts_unit: "응시",
  detail_correct_rate_prefix: "정답률",
  detail_correct_label: "정답",
  detail_card_hint_poll: "옵션을 클릭하면 해당 응답자들로 다른 패널이 좁혀집니다 · 복수 선택 가능",
  detail_card_hint_quiz: "답을 클릭하면 그 답을 고른 응시자들로 다른 패널이 좁혀집니다 · 복수 선택 가능",
  detail_poll_card1_title: "가장 시급하게 추진해야 할 헌법 개정 분야는?",
  detail_poll_card2_title: "개헌 시 가장 중요하게 다뤄져야 할 가치는?",
  detail_poll_card3_title: "개헌 추진 과정에서 반드시 고려해야 할 점을 자유롭게 작성해주세요",
  detail_poll_title: "귀하는 현재 대한민국 헌법을 개정하는 것이 필요하다고 생각하십니까?",
  detail_quiz_title: "헌법 기본 상식 퀴즈",
  detail_quiz_card1_title: "헌법재판소의 재판관 수는?",
  detail_quiz_card2_title: "대한민국의 입법권은 어디에 있는가?",
  detail_quiz_card3_title: "헌법 제1조의 내용은?",
  detail_discussion_title: "비동의 강간죄 도입에 대해서 어떻게 생각하십니까?",
  detail_discussion_settings_title: "분석 설정",
  detail_discussion_topic_modeling_label: "Topic Modeling",
  detail_discussion_lda_label: "LDA 토픽 개수",
  detail_discussion_lda_hint: "1~20 사이로 입력해주세요.",
  detail_discussion_tfidf_label: "TF-IDF 키워드 개수",
  detail_discussion_network_label: "네트워크 상위 노드 개수",
  detail_discussion_network_hint: "1~30 사이로 입력해주세요.",
  detail_discussion_excluded_label: "제외된 토픽",
  detail_discussion_excluded_placeholder: "예: 이거, 그거",
  detail_discussion_excluded_hint: "쉼표(,)로 구분해 입력해주세요.",
  detail_discussion_btn_reset: "초기화",
  detail_discussion_btn_apply: "확인",
  detail_tfidf_card_title: "TF-IDF 키워드",
  detail_tfidf_card_count: "Score",
  detail_lda_card_title: "LDA 토픽 모델링",
  detail_lda_edit_label: "토픽 라벨 편집",
  detail_lda_col_topic: "토픽",
  detail_lda_col_keywords: "키워드",
  detail_lda_col_filter: "필터",
  detail_lda_filter_aria_prefix: "필터 토글:",
  detail_network_card_title: "텍스트 네트워크",
  detail_network_card_count: "Co-occurrence",
  detail_network_aria: "텍스트 네트워크",
  detail_follow_title: "법률 전문가 팔로우 캠페인",
  detail_follow_card_title: "팔로우 대상별 수행률",
  detail_follow_count_text: "42명 참여 · 12 타겟",
  detail_follow_legend_done: "수행함",
  detail_follow_legend_miss: "미수행",
  detail_back_btn_aria: "뒤로",
  detail_records_btn: "사용된 데이터 확인하기",
  records_page_title: "사용된 raw 데이터",
  records_page_hint: "보고서 저장 시점에 frozen된 데이터입니다. 칩을 눌러 필터링하세요.",
  records_empty: "이 필터에 매칭된 데이터가 없어요.",
  records_col_user: "사용자",
  records_col_question: "문항",
  records_col_answer: "응답",
  records_col_post_title: "글",
  records_col_comment: "코멘트",
  records_col_target: "팔로우 대상",
  records_load_more: "더 불러오기",
  create_preview_records_label: "사용된 데이터 샘플",
  create_preview_records_limit_hint: "preview는 필터당 최대 50개의 데이터만 표시됩니다.",
  create_preview_records_empty: "아직 매칭된 데이터가 없어요 — 다음을 눌러 불러오세요.",
  detail_sb_item_meta_questions: "문항",
  detail_sb_item_meta_responses: "응답",
  detail_sb_item_meta_attempts: "응시",
  detail_sb_item_meta_comments: "댓글",
  detail_sb_item_meta_participants: "참여",
  detail_sb_item_meta_targets: "타겟",
  detail_sb_item_meta_options: "선지",
  detail_sb_item_meta_correct: "정답",
  detail_sb_item_meta_followers: "팔로워",
  detail_panel_empty_title: "데이터 없음",
  detail_panel_empty_poll: "응답자들이 답한 설문 문항이 아직 없습니다.",
  detail_panel_empty_quiz: "응답자들이 응시한 퀴즈가 아직 없습니다.",
  detail_panel_empty_follow: "응답자들이 팔로우한 타겟이 아직 없습니다.",
  detail_panel_empty_text_answers: "수집된 텍스트 응답이 없습니다.",
  detail_discussion_pick_title: "토론을 선택하세요",
  detail_discussion_pick_hint: "왼쪽 사이드바에서 토론을 선택하면 분석 설정을 진행할 수 있습니다.",
  detail_discussion_no_run_title: "아직 분석되지 않음",
  detail_discussion_no_run_hint: "위에서 파라미터를 설정한 뒤 확인을 누르면 LDA / TF-IDF / 네트워크 분석이 실행됩니다.",
  detail_discussion_running_title: "분석 진행 중",
  detail_discussion_running_hint: "분석이 진행 중입니다. 완료되면 결과가 표시됩니다.",
  detail_discussion_failed_title: "분석 실패",
  detail_discussion_failed_hint: "분석 도중 문제가 발생했습니다. 파라미터를 조정한 뒤 다시 시도해주세요.",
  detail_tfidf_card_count_suffix: "개 단어",
  detail_lda_card_count_suffix: "개 토픽",
  detail_network_card_count_suffix: "개 노드",
  detail_network_card_edge_suffix: "개 엣지",
  create_topbar_title: "새 분석 만들기",
  create_cf_title: "교차 필터",
  create_cf_hint: "분석에 사용할 데이터 조건을 선택하세요. 비워두면 전체 데이터로 분석합니다.",
  create_cf_chips_all: "전체",
  create_cf_add_filter: "필터 추가",
  create_cf_pick_action_label: "어떤 액션의 데이터를 추가할까요?",
  create_cf_pick_action_cancel: "취소",
  create_cf_pick_item_label: "분석할 항목을 하나 선택하세요",
  create_cf_pick_item_label_with_type: "— 분석할 항목 하나 선택",
  create_cf_back_to_action: "← 액션 다시 선택",
  create_cf_remove_filter_aria: "필터 제거",
  create_action_tile_poll: "Poll",
  create_action_tile_quiz: "Quiz",
  create_action_tile_discussion: "Discussion",
  create_action_tile_follow: "Follow",
  create_action_count_unit: "개",
  create_action_questions_unit: "문항",
  create_sunji_follow_title: "팔로우 타겟",
  create_sunji_follow_empty: "등록된 팔로우 타겟이 없습니다",
  create_sunji_back: "← 다시 선택",
  create_sunji_default_title: "선택한 항목",
  create_sunji_confirm: "확인",
  create_sunji_empty: "이 항목에는 선택할 선지가 없습니다.",
  create_sunji_loading: "문항을 불러오는 중…",
  create_sunji_correct_badge: "정답",
  create_keyword_block_title: "키워드 입력 (쉼표로 구분)",
  create_keyword_input_placeholder: "예: 증거, 진술, 피해자",
  create_keyword_hint: "각 키워드는 별도 필터로 추가됩니다.",
  create_preview_title: "미리보기",
  create_preview_hint: "아래 내용으로 보고서가 생성됩니다. 분석명을 입력하고 \"보고서 생성\"을 누르세요.",
  create_preview_name_label: "분석명",
  create_preview_name_placeholder: "예: 헌법 개정 의견과 무고죄 인식 교차분석",
  create_preview_name_hint: "결과 페이지와 목록 카드의 제목으로 사용됩니다.",
  create_preview_chips_label: "선택된 교차 필터",
  create_preview_stat_respondents: "해당 응답자",
  create_preview_stat_records: "해당되는 데이터 수",
  create_preview_correct_tag: "정답",
  create_pager_prev: "← 이전",
  create_pager_next: "다음 →",
  create_footer_step_label_create: "1 / 2",
  create_footer_step_label_preview: "2 / 2",
  create_footer_cancel: "취소",
  create_footer_next: "다음 →",
  create_footer_back: "← 이전",
  create_footer_confirm: "보고서 생성",
};

export const i18n = { en, ko };

export interface SpaceAnalyzesAppI18n {
  pageTitle: string;
  pollSectionTitle: string;
  discussionSectionTitle: string;
  sampleSurvey: string;
  finalSurvey: string;
  questions: string;
  viewAnalyze: string;
  more: string;
  noPolls: string;
  noDiscussions: string;
  toBeContinue: string;
  untitledDiscussion: string;
  backToList: string;
  downloadExcel: string;
  downloadStarted: string;
  responsesCount: string;
  remainingDays: string;
  surveyPeriod: string;
  filterLabel: string;
  filterGroupLabel: string;
  filterValueLabel: string;
  filterAll: string;
  filterGender: string;
  filterAge: string;
  filterSchool: string;
  genderMale: string;
  genderFemale: string;
  genderUnknown: string;
  totalQuestions: string;
  totalResponseCountUnit: string;
  noTextResponses: string;
  otherLabel: string;
  /** Privacy-consent result row for respondents who agreed. */
  consentAgreedLabel: string;
  /** Privacy-consent result row for respondents who declined and ended the poll. */
  consentDeclinedLabel: string;
  id: string;
  attribute: string;
  category: string;
  type: string;
  questionnaire: string;
  question: string;
  answer: string;
  university: string;
  arenaBreadcrumbApps: string;
  arenaBreadcrumbCurrent: string;
  arenaTopbarTitle: string;
  listHeading: string;
  listCountUnit: string;
  listHint: string;
  newAnalysisTitle: string;
  newAnalysisDesc: string;
  statusFinish: string;
  statusInProgress: string;
  statusFailed: string;
  chipsEmpty: string;
  listCardPendingToast: string;
  arrowPrevLabel: string;
  arrowNextLabel: string;
  dotNewLabel: string;
  dotReportLabelPrefix: string;
  detailSidebarLabel: string;
  detailActiveFiltersLabel: string;
  detailActiveFiltersEmpty: string;
  detailMetaFilterCount: string;
  detailMetaFilterCountUnit: string;
  detailMetaCreatedPrefix: string;
  detailPanelChipPoll: string;
  detailPanelChipQuiz: string;
  detailPanelChipDiscussion: string;
  detailPanelChipFollow: string;
  detailGroupPoll: string;
  detailGroupQuiz: string;
  detailGroupDiscussion: string;
  detailGroupFollow: string;
  detailFilterAll: string;
  detailFilterGender: string;
  detailFilterAge: string;
  detailFilterSchool: string;
  detailDownloadBtn: string;
  detailDownloadPollTestidLabel: string;
  detailResponsesUnit: string;
  detailAttemptsUnit: string;
  detailCorrectRatePrefix: string;
  detailCorrectLabel: string;
  detailCardHintPoll: string;
  detailCardHintQuiz: string;
  detailPollCard1Title: string;
  detailPollCard2Title: string;
  detailPollCard3Title: string;
  detailPollTitle: string;
  detailQuizTitle: string;
  detailQuizCard1Title: string;
  detailQuizCard2Title: string;
  detailQuizCard3Title: string;
  detailDiscussionTitle: string;
  detailDiscussionSettingsTitle: string;
  detailDiscussionTopicModelingLabel: string;
  detailDiscussionLdaLabel: string;
  detailDiscussionLdaHint: string;
  detailDiscussionTfidfLabel: string;
  detailDiscussionNetworkLabel: string;
  detailDiscussionNetworkHint: string;
  detailDiscussionExcludedLabel: string;
  detailDiscussionExcludedPlaceholder: string;
  detailDiscussionExcludedHint: string;
  detailDiscussionBtnReset: string;
  detailDiscussionBtnApply: string;
  detailTfidfCardTitle: string;
  detailTfidfCardCount: string;
  detailLdaCardTitle: string;
  detailLdaEditLabel: string;
  detailLdaColTopic: string;
  detailLdaColKeywords: string;
  detailLdaColFilter: string;
  detailLdaFilterAriaPrefix: string;
  detailNetworkCardTitle: string;
  detailNetworkCardCount: string;
  detailNetworkAria: string;
  detailFollowTitle: string;
  detailFollowCardTitle: string;
  detailFollowCountText: string;
  detailFollowLegendDone: string;
  detailFollowLegendMiss: string;
  detailBackBtnAria: string;
  detailRecordsBtn: string;
  recordsPageTitle: string;
  recordsPageHint: string;
  recordsEmpty: string;
  recordsColUser: string;
  recordsColQuestion: string;
  recordsColAnswer: string;
  recordsColPostTitle: string;
  recordsColComment: string;
  recordsColTarget: string;
  recordsLoadMore: string;
  createPreviewRecordsLabel: string;
  createPreviewRecordsLimitHint: string;
  createPreviewRecordsEmpty: string;
  detailSbItemMetaQuestions: string;
  detailSbItemMetaResponses: string;
  detailSbItemMetaAttempts: string;
  detailSbItemMetaComments: string;
  detailSbItemMetaParticipants: string;
  detailSbItemMetaTargets: string;
  detailSbItemMetaOptions: string;
  detailSbItemMetaCorrect: string;
  detailSbItemMetaFollowers: string;
  detailPanelEmptyTitle: string;
  detailPanelEmptyPoll: string;
  detailPanelEmptyQuiz: string;
  detailPanelEmptyFollow: string;
  detailPanelEmptyTextAnswers: string;
  detailDiscussionPickTitle: string;
  detailDiscussionPickHint: string;
  detailDiscussionNoRunTitle: string;
  detailDiscussionNoRunHint: string;
  detailDiscussionRunningTitle: string;
  detailDiscussionRunningHint: string;
  detailDiscussionFailedTitle: string;
  detailDiscussionFailedHint: string;
  detailTfidfCardCountSuffix: string;
  detailLdaCardCountSuffix: string;
  detailNetworkCardCountSuffix: string;
  detailNetworkCardEdgeSuffix: string;
  createTopbarTitle: string;
  createCfTitle: string;
  createCfHint: string;
  createCfChipsAll: string;
  createCfAddFilter: string;
  createCfPickActionLabel: string;
  createCfPickActionCancel: string;
  createCfPickItemLabel: string;
  createCfPickItemLabelWithType: string;
  createCfBackToAction: string;
  createCfRemoveFilterAria: string;
  createActionTilePoll: string;
  createActionTileQuiz: string;
  createActionTileDiscussion: string;
  createActionTileFollow: string;
  createActionCountUnit: string;
  createActionQuestionsUnit: string;
  createSunjiFollowTitle: string;
  createSunjiFollowEmpty: string;
  createSunjiBack: string;
  createSunjiDefaultTitle: string;
  createSunjiConfirm: string;
  createSunjiEmpty: string;
  createSunjiLoading: string;
  createSunjiCorrectBadge: string;
  createKeywordBlockTitle: string;
  createKeywordInputPlaceholder: string;
  createKeywordHint: string;
  createPreviewTitle: string;
  createPreviewHint: string;
  createPreviewNameLabel: string;
  createPreviewNamePlaceholder: string;
  createPreviewNameHint: string;
  createPreviewChipsLabel: string;
  createPreviewStatRespondents: string;
  createPreviewStatRecords: string;
  createPreviewCorrectTag: string;
  createPagerPrev: string;
  createPagerNext: string;
  createFooterStepLabelCreate: string;
  createFooterStepLabelPreview: string;
  createFooterCancel: string;
  createFooterNext: string;
  createFooterBack: string;
  createFooterConfirm: string;
}

export function useSpaceAnalyzesAppI18n(): SpaceAnalyzesAppI18n {
  const { t } = useTranslation("spaceAnalyzesApp");
  return {
    pageTitle: t("page_title"),
    pollSectionTitle: t("poll_section_title"),
    discussionSectionTitle: t("discussion_section_title"),
    sampleSurvey: t("sample_survey"),
    finalSurvey: t("final_survey"),
    questions: t("questions"),
    viewAnalyze: t("view_analyze"),
    more: t("more"),
    noPolls: t("no_polls"),
    noDiscussions: t("no_discussions"),
    toBeContinue: t("to_be_continue"),
    untitledDiscussion: t("untitled_discussion"),
    backToList: t("back_to_list"),
    downloadExcel: t("download_excel"),
    downloadStarted: t("download_started"),
    responsesCount: t("responses_count"),
    remainingDays: t("remaining_days"),
    surveyPeriod: t("survey_period"),
    filterLabel: t("filter_label"),
    filterGroupLabel: t("filter_group_label"),
    filterValueLabel: t("filter_value_label"),
    filterAll: t("filter_all"),
    filterGender: t("filter_gender"),
    filterAge: t("filter_age"),
    filterSchool: t("filter_school"),
    genderMale: t("gender_male"),
    genderFemale: t("gender_female"),
    genderUnknown: t("gender_unknown"),
    totalQuestions: t("total_questions"),
    totalResponseCountUnit: t("total_response_count_unit"),
    noTextResponses: t("no_text_responses"),
    otherLabel: t("other_label"),
    consentAgreedLabel: t("consent_agreed_label"),
    consentDeclinedLabel: t("consent_declined_label"),
    id: t("id"),
    attribute: t("attribute"),
    category: t("category"),
    type: t("type_"),
    questionnaire: t("questionnaire"),
    question: t("question"),
    answer: t("answer"),
    university: t("university"),
    arenaBreadcrumbApps: t("arena_breadcrumb_apps"),
    arenaBreadcrumbCurrent: t("arena_breadcrumb_current"),
    arenaTopbarTitle: t("arena_topbar_title"),
    listHeading: t("list_heading"),
    listCountUnit: t("list_count_unit"),
    listHint: t("list_hint"),
    newAnalysisTitle: t("new_analysis_title"),
    newAnalysisDesc: t("new_analysis_desc"),
    statusFinish: t("status_finish"),
    statusInProgress: t("status_in_progress"),
    statusFailed: t("status_failed"),
    chipsEmpty: t("chips_empty"),
    listCardPendingToast: t("list_card_pending_toast"),
    arrowPrevLabel: t("arrow_prev_label"),
    arrowNextLabel: t("arrow_next_label"),
    dotNewLabel: t("dot_new_label"),
    dotReportLabelPrefix: t("dot_report_label_prefix"),
    detailSidebarLabel: t("detail_sidebar_label"),
    detailActiveFiltersLabel: t("detail_active_filters_label"),
    detailActiveFiltersEmpty: t("detail_active_filters_empty"),
    detailMetaFilterCount: t("detail_meta_filter_count"),
    detailMetaFilterCountUnit: t("detail_meta_filter_count_unit"),
    detailMetaCreatedPrefix: t("detail_meta_created_prefix"),
    detailPanelChipPoll: t("detail_panel_chip_poll"),
    detailPanelChipQuiz: t("detail_panel_chip_quiz"),
    detailPanelChipDiscussion: t("detail_panel_chip_discussion"),
    detailPanelChipFollow: t("detail_panel_chip_follow"),
    detailGroupPoll: t("detail_group_poll"),
    detailGroupQuiz: t("detail_group_quiz"),
    detailGroupDiscussion: t("detail_group_discussion"),
    detailGroupFollow: t("detail_group_follow"),
    detailFilterAll: t("detail_filter_all"),
    detailFilterGender: t("detail_filter_gender"),
    detailFilterAge: t("detail_filter_age"),
    detailFilterSchool: t("detail_filter_school"),
    detailDownloadBtn: t("detail_download_btn"),
    detailDownloadPollTestidLabel: t("detail_download_poll_testid_label"),
    detailResponsesUnit: t("detail_responses_unit"),
    detailAttemptsUnit: t("detail_attempts_unit"),
    detailCorrectRatePrefix: t("detail_correct_rate_prefix"),
    detailCorrectLabel: t("detail_correct_label"),
    detailCardHintPoll: t("detail_card_hint_poll"),
    detailCardHintQuiz: t("detail_card_hint_quiz"),
    detailPollCard1Title: t("detail_poll_card1_title"),
    detailPollCard2Title: t("detail_poll_card2_title"),
    detailPollCard3Title: t("detail_poll_card3_title"),
    detailPollTitle: t("detail_poll_title"),
    detailQuizTitle: t("detail_quiz_title"),
    detailQuizCard1Title: t("detail_quiz_card1_title"),
    detailQuizCard2Title: t("detail_quiz_card2_title"),
    detailQuizCard3Title: t("detail_quiz_card3_title"),
    detailDiscussionTitle: t("detail_discussion_title"),
    detailDiscussionSettingsTitle: t("detail_discussion_settings_title"),
    detailDiscussionTopicModelingLabel: t("detail_discussion_topic_modeling_label"),
    detailDiscussionLdaLabel: t("detail_discussion_lda_label"),
    detailDiscussionLdaHint: t("detail_discussion_lda_hint"),
    detailDiscussionTfidfLabel: t("detail_discussion_tfidf_label"),
    detailDiscussionNetworkLabel: t("detail_discussion_network_label"),
    detailDiscussionNetworkHint: t("detail_discussion_network_hint"),
    detailDiscussionExcludedLabel: t("detail_discussion_excluded_label"),
    detailDiscussionExcludedPlaceholder: t("detail_discussion_excluded_placeholder"),
    detailDiscussionExcludedHint: t("detail_discussion_excluded_hint"),
    detailDiscussionBtnReset: t("detail_discussion_btn_reset"),
    detailDiscussionBtnApply: t("detail_discussion_btn_apply"),
    detailTfidfCardTitle: t("detail_tfidf_card_title"),
    detailTfidfCardCount: t("detail_tfidf_card_count"),
    detailLdaCardTitle: t("detail_lda_card_title"),
    detailLdaEditLabel: t("detail_lda_edit_label"),
    detailLdaColTopic: t("detail_lda_col_topic"),
    detailLdaColKeywords: t("detail_lda_col_keywords"),
    detailLdaColFilter: t("detail_lda_col_filter"),
    detailLdaFilterAriaPrefix: t("detail_lda_filter_aria_prefix"),
    detailNetworkCardTitle: t("detail_network_card_title"),
    detailNetworkCardCount: t("detail_network_card_count"),
    detailNetworkAria: t("detail_network_aria"),
    detailFollowTitle: t("detail_follow_title"),
    detailFollowCardTitle: t("detail_follow_card_title"),
    detailFollowCountText: t("detail_follow_count_text"),
    detailFollowLegendDone: t("detail_follow_legend_done"),
    detailFollowLegendMiss: t("detail_follow_legend_miss"),
    detailBackBtnAria: t("detail_back_btn_aria"),
    detailRecordsBtn: t("detail_records_btn"),
    recordsPageTitle: t("records_page_title"),
    recordsPageHint: t("records_page_hint"),
    recordsEmpty: t("records_empty"),
    recordsColUser: t("records_col_user"),
    recordsColQuestion: t("records_col_question"),
    recordsColAnswer: t("records_col_answer"),
    recordsColPostTitle: t("records_col_post_title"),
    recordsColComment: t("records_col_comment"),
    recordsColTarget: t("records_col_target"),
    recordsLoadMore: t("records_load_more"),
    createPreviewRecordsLabel: t("create_preview_records_label"),
    createPreviewRecordsLimitHint: t("create_preview_records_limit_hint"),
    createPreviewRecordsEmpty: t("create_preview_records_empty"),
    detailSbItemMetaQuestions: t("detail_sb_item_meta_questions"),
    detailSbItemMetaResponses: t("detail_sb_item_meta_responses"),
    detailSbItemMetaAttempts: t("detail_sb_item_meta_attempts"),
    detailSbItemMetaComments: t("detail_sb_item_meta_comments"),
    detailSbItemMetaParticipants: t("detail_sb_item_meta_participants"),
    detailSbItemMetaTargets: t("detail_sb_item_meta_targets"),
    detailSbItemMetaOptions: t("detail_sb_item_meta_options"),
    detailSbItemMetaCorrect: t("detail_sb_item_meta_correct"),
    detailSbItemMetaFollowers: t("detail_sb_item_meta_followers"),
    detailPanelEmptyTitle: t("detail_panel_empty_title"),
    detailPanelEmptyPoll: t("detail_panel_empty_poll"),
    detailPanelEmptyQuiz: t("detail_panel_empty_quiz"),
    detailPanelEmptyFollow: t("detail_panel_empty_follow"),
    detailPanelEmptyTextAnswers: t("detail_panel_empty_text_answers"),
    detailDiscussionPickTitle: t("detail_discussion_pick_title"),
    detailDiscussionPickHint: t("detail_discussion_pick_hint"),
    detailDiscussionNoRunTitle: t("detail_discussion_no_run_title"),
    detailDiscussionNoRunHint: t("detail_discussion_no_run_hint"),
    detailDiscussionRunningTitle: t("detail_discussion_running_title"),
    detailDiscussionRunningHint: t("detail_discussion_running_hint"),
    detailDiscussionFailedTitle: t("detail_discussion_failed_title"),
    detailDiscussionFailedHint: t("detail_discussion_failed_hint"),
    detailTfidfCardCountSuffix: t("detail_tfidf_card_count_suffix"),
    detailLdaCardCountSuffix: t("detail_lda_card_count_suffix"),
    detailNetworkCardCountSuffix: t("detail_network_card_count_suffix"),
    detailNetworkCardEdgeSuffix: t("detail_network_card_edge_suffix"),
    createTopbarTitle: t("create_topbar_title"),
    createCfTitle: t("create_cf_title"),
    createCfHint: t("create_cf_hint"),
    createCfChipsAll: t("create_cf_chips_all"),
    createCfAddFilter: t("create_cf_add_filter"),
    createCfPickActionLabel: t("create_cf_pick_action_label"),
    createCfPickActionCancel: t("create_cf_pick_action_cancel"),
    createCfPickItemLabel: t("create_cf_pick_item_label"),
    createCfPickItemLabelWithType: t("create_cf_pick_item_label_with_type"),
    createCfBackToAction: t("create_cf_back_to_action"),
    createCfRemoveFilterAria: t("create_cf_remove_filter_aria"),
    createActionTilePoll: t("create_action_tile_poll"),
    createActionTileQuiz: t("create_action_tile_quiz"),
    createActionTileDiscussion: t("create_action_tile_discussion"),
    createActionTileFollow: t("create_action_tile_follow"),
    createActionCountUnit: t("create_action_count_unit"),
    createActionQuestionsUnit: t("create_action_questions_unit"),
    createSunjiFollowTitle: t("create_sunji_follow_title"),
    createSunjiFollowEmpty: t("create_sunji_follow_empty"),
    createSunjiBack: t("create_sunji_back"),
    createSunjiDefaultTitle: t("create_sunji_default_title"),
    createSunjiConfirm: t("create_sunji_confirm"),
    createSunjiEmpty: t("create_sunji_empty"),
    createSunjiLoading: t("create_sunji_loading"),
    createSunjiCorrectBadge: t("create_sunji_correct_badge"),
    createKeywordBlockTitle: t("create_keyword_block_title"),
    createKeywordInputPlaceholder: t("create_keyword_input_placeholder"),
    createKeywordHint: t("create_keyword_hint"),
    createPreviewTitle: t("create_preview_title"),
    createPreviewHint: t("create_preview_hint"),
    createPreviewNameLabel: t("create_preview_name_label"),
    createPreviewNamePlaceholder: t("create_preview_name_placeholder"),
    createPreviewNameHint: t("create_preview_name_hint"),
    createPreviewChipsLabel: t("create_preview_chips_label"),
    createPreviewStatRespondents: t("create_preview_stat_respondents"),
    createPreviewStatRecords: t("create_preview_stat_records"),
    createPreviewCorrectTag: t("create_preview_correct_tag"),
    createPagerPrev: t("create_pager_prev"),
    createPagerNext: t("create_pager_next"),
    createFooterStepLabelCreate: t("create_footer_step_label_create"),
    createFooterStepLabelPreview: t("create_footer_step_label_preview"),
    createFooterCancel: t("create_footer_cancel"),
    createFooterNext: t("create_footer_next"),
    createFooterBack: t("create_footer_back"),
    createFooterConfirm: t("create_footer_confirm"),
  };
}
