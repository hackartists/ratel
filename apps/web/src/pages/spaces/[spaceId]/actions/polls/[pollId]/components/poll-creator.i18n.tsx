// Ported from: app/ratel/src/features/spaces/pages/actions/actions/poll/views/main/creator/i18n.rs (`PollCreatorTranslate`). Namespace "pollCreator".
import { useTranslation } from "react-i18next";

const en = {
  type_badge_label: "Poll",
  footer_status: "All changes saved",
  autosave_saving: "Saving...",
  autosave_saved: "Saved",
  autosave_unsaved: "Unsaved",
  card_content_title: "Content",
  card_content_subtitle: "Title and questions",
  card_config_title: "Configuration",
  card_config_subtitle: "Schedule, rewards, voting rules, and danger zone",
  section_content_label: "Content",
  section_content_hint: "Markdown supported",
  section_questions_label: "Questions",
  section_questions_hint: "Min 1 · Max 20",
  section_schedule_label: "Schedule",
  section_voting_rules_label: "Voting rules",
  section_participation_label: "Participation & Rewards",
  section_dependencies_label: "Dependency Actions",
  section_status_label: "Status",
  section_danger_label: "Danger zone",
  title_label: "Title",
  title_placeholder: "Enter poll title...",
  qtype_single: "Single",
  qtype_multi: "Multi",
  qtype_subjective: "Subjective",
  qtype_linear: "Linear",
  qtype_privacy_consent: "Privacy Consent",
  remove_question: "Remove question",
  add_question: "Add question",
  add_option: "Add option",
  remove_option: "Remove option",
  option_placeholder: "Option text",
  allow_other: "Allow \"Other\" option",
  subjective_hint: "Response hint · shown to voters",
  subjective_placeholder: "Optional prompt shown above the response box...",
  linear_min_label: "Min",
  linear_max_label: "Max",
  privacy_consent_terms_title_label: "Consent terms title",
  privacy_consent_terms_title_placeholder: "e.g. Phone Number Collection & Use Consent",
  privacy_consent_terms_body_label: "Consent terms body",
  privacy_consent_always_on: "Phone collection always on — no toggle",
  privacy_consent_description_placeholder: "Shown under the title to the respondent",
  schedule_starts_at: "Starts at",
  schedule_ends_at: "Ends at",
  voting_response_editable_label: "Allow response editing",
  voting_response_editable_sub: "Participants can update their answers while the poll is open",
  voting_encrypted_label: "Encrypted upload",
  voting_encrypted_sub: "Encrypt vote results and store on-chain. Responses cannot be edited after submission.",
  tile_reward: "Reward (CR)",
  delete_poll_title: "Delete this poll",
  delete_poll_desc: "Removes the poll and all submissions. Rewards already paid are not refunded.",
  delete_poll_btn: "Delete poll",
  card_index_1: "01 / 02",
  card_index_2: "02 / 02",
  condition_hint: "Show this question only when earlier answers match. Values in one rule match if any is chosen.",
  condition_empty: "No earlier single or multiple choice question to branch on.",
  condition_add: "+ Add display condition",
  terminate_hint: "End the poll when this option is chosen:",
};

const ko: Record<keyof typeof en, string> = {
  type_badge_label: "투표",
  footer_status: "모든 변경사항 저장됨",
  autosave_saving: "저장 중...",
  autosave_saved: "저장됨",
  autosave_unsaved: "저장 안됨",
  card_content_title: "내용",
  card_content_subtitle: "제목 및 질문",
  card_config_title: "설정",
  card_config_subtitle: "일정, 보상, 투표 규칙, 위험 영역",
  section_content_label: "내용",
  section_content_hint: "Markdown 지원",
  section_questions_label: "질문",
  section_questions_hint: "최소 1 · 최대 20",
  section_schedule_label: "일정",
  section_voting_rules_label: "투표 규칙",
  section_participation_label: "참여 및 보상",
  section_dependencies_label: "선행 액션",
  section_status_label: "상태",
  section_danger_label: "위험 영역",
  title_label: "제목",
  title_placeholder: "투표 제목을 입력하세요...",
  qtype_single: "단일",
  qtype_multi: "다중",
  qtype_subjective: "주관식",
  qtype_linear: "선형",
  qtype_privacy_consent: "개인정보 동의",
  remove_question: "질문 삭제",
  add_question: "질문 추가",
  add_option: "선지 추가",
  remove_option: "선지 삭제",
  option_placeholder: "선지 내용",
  allow_other: "기타 옵션 허용",
  subjective_hint: "응답 힌트 · 투표자에게 표시",
  subjective_placeholder: "응답 상자 위에 표시되는 선택적 프롬프트...",
  linear_min_label: "최소",
  linear_max_label: "최대",
  privacy_consent_terms_title_label: "약관 제목",
  privacy_consent_terms_title_placeholder: "예: 휴대폰 번호 수집 및 이용 동의",
  privacy_consent_terms_body_label: "약관 본문",
  privacy_consent_always_on: "휴대폰 수집 항상 켜짐 — 토글 없음",
  privacy_consent_description_placeholder: "응답자에게 제목 아래 표시됩니다",
  schedule_starts_at: "시작",
  schedule_ends_at: "종료",
  voting_response_editable_label: "응답 수정 허용",
  voting_response_editable_sub: "투표 진행 중 참여자가 응답을 수정할 수 있음",
  voting_encrypted_label: "암호화 업로드",
  voting_encrypted_sub: "투표 결과를 암호화하여 온체인 저장. 제출 후 응답 수정 불가",
  tile_reward: "보상 (CR)",
  delete_poll_title: "투표 삭제",
  delete_poll_desc: "투표와 모든 제출물을 삭제합니다. 이미 지급된 보상은 환불되지 않습니다.",
  delete_poll_btn: "투표 삭제",
  card_index_1: "01 / 02",
  card_index_2: "02 / 02",
  condition_hint: "앞 문항의 응답이 조건에 맞을 때만 이 문항을 보여줍니다. 한 조건 안의 값은 하나라도 선택되면 충족됩니다.",
  condition_empty: "조건으로 사용할 앞선 단일/복수 선택 문항이 없습니다.",
  condition_add: "+ 노출 조건 추가",
  terminate_hint: "이 선택지를 고르면 설문 종료:",
};

export const i18n = { en, ko };

export interface PollCreatorI18n {
  typeBadgeLabel: string;
  footerStatus: string;
  autosaveSaving: string;
  autosaveSaved: string;
  autosaveUnsaved: string;
  cardContentTitle: string;
  cardContentSubtitle: string;
  cardConfigTitle: string;
  cardConfigSubtitle: string;
  sectionContentLabel: string;
  sectionContentHint: string;
  sectionQuestionsLabel: string;
  sectionQuestionsHint: string;
  sectionScheduleLabel: string;
  sectionVotingRulesLabel: string;
  sectionParticipationLabel: string;
  sectionDependenciesLabel: string;
  sectionStatusLabel: string;
  sectionDangerLabel: string;
  titleLabel: string;
  titlePlaceholder: string;
  qtypeSingle: string;
  qtypeMulti: string;
  qtypeSubjective: string;
  qtypeLinear: string;
  qtypePrivacyConsent: string;
  removeQuestion: string;
  addQuestion: string;
  addOption: string;
  removeOption: string;
  optionPlaceholder: string;
  allowOther: string;
  subjectiveHint: string;
  subjectivePlaceholder: string;
  linearMinLabel: string;
  linearMaxLabel: string;
  privacyConsentTermsTitleLabel: string;
  privacyConsentTermsTitlePlaceholder: string;
  privacyConsentTermsBodyLabel: string;
  privacyConsentAlwaysOn: string;
  privacyConsentDescriptionPlaceholder: string;
  scheduleStartsAt: string;
  scheduleEndsAt: string;
  votingResponseEditableLabel: string;
  votingResponseEditableSub: string;
  votingEncryptedLabel: string;
  votingEncryptedSub: string;
  tileReward: string;
  deletePollTitle: string;
  deletePollDesc: string;
  deletePollBtn: string;
  cardIndex1: string;
  cardIndex2: string;
  conditionHint: string;
  conditionEmpty: string;
  conditionAdd: string;
  terminateHint: string;
}

export function usePollCreatorI18n(): PollCreatorI18n {
  const { t } = useTranslation("pollCreator");
  return {
    typeBadgeLabel: t("type_badge_label"),
    footerStatus: t("footer_status"),
    autosaveSaving: t("autosave_saving"),
    autosaveSaved: t("autosave_saved"),
    autosaveUnsaved: t("autosave_unsaved"),
    cardContentTitle: t("card_content_title"),
    cardContentSubtitle: t("card_content_subtitle"),
    cardConfigTitle: t("card_config_title"),
    cardConfigSubtitle: t("card_config_subtitle"),
    sectionContentLabel: t("section_content_label"),
    sectionContentHint: t("section_content_hint"),
    sectionQuestionsLabel: t("section_questions_label"),
    sectionQuestionsHint: t("section_questions_hint"),
    sectionScheduleLabel: t("section_schedule_label"),
    sectionVotingRulesLabel: t("section_voting_rules_label"),
    sectionParticipationLabel: t("section_participation_label"),
    sectionDependenciesLabel: t("section_dependencies_label"),
    sectionStatusLabel: t("section_status_label"),
    sectionDangerLabel: t("section_danger_label"),
    titleLabel: t("title_label"),
    titlePlaceholder: t("title_placeholder"),
    qtypeSingle: t("qtype_single"),
    qtypeMulti: t("qtype_multi"),
    qtypeSubjective: t("qtype_subjective"),
    qtypeLinear: t("qtype_linear"),
    qtypePrivacyConsent: t("qtype_privacy_consent"),
    removeQuestion: t("remove_question"),
    addQuestion: t("add_question"),
    addOption: t("add_option"),
    removeOption: t("remove_option"),
    optionPlaceholder: t("option_placeholder"),
    allowOther: t("allow_other"),
    subjectiveHint: t("subjective_hint"),
    subjectivePlaceholder: t("subjective_placeholder"),
    linearMinLabel: t("linear_min_label"),
    linearMaxLabel: t("linear_max_label"),
    privacyConsentTermsTitleLabel: t("privacy_consent_terms_title_label"),
    privacyConsentTermsTitlePlaceholder: t("privacy_consent_terms_title_placeholder"),
    privacyConsentTermsBodyLabel: t("privacy_consent_terms_body_label"),
    privacyConsentAlwaysOn: t("privacy_consent_always_on"),
    privacyConsentDescriptionPlaceholder: t("privacy_consent_description_placeholder"),
    scheduleStartsAt: t("schedule_starts_at"),
    scheduleEndsAt: t("schedule_ends_at"),
    votingResponseEditableLabel: t("voting_response_editable_label"),
    votingResponseEditableSub: t("voting_response_editable_sub"),
    votingEncryptedLabel: t("voting_encrypted_label"),
    votingEncryptedSub: t("voting_encrypted_sub"),
    tileReward: t("tile_reward"),
    deletePollTitle: t("delete_poll_title"),
    deletePollDesc: t("delete_poll_desc"),
    deletePollBtn: t("delete_poll_btn"),
    cardIndex1: t("card_index_1"),
    cardIndex2: t("card_index_2"),
    conditionHint: t("condition_hint"),
    conditionEmpty: t("condition_empty"),
    conditionAdd: t("condition_add"),
    terminateHint: t("terminate_hint"),
  };
}
