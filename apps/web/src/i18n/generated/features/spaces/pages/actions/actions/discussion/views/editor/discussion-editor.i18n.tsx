// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/spaces/pages/actions/actions/discussion/views/editor/i18n.rs (`DiscussionEditorTranslate`). Namespace "discussionEditor".
import { useTranslation } from "react-i18next";

const en = {
  type_badge_label: "Discussion",
  import_from_overview: "Import from overview",
  footer_status: "All changes saved",
  autosave_saving: "Saving...",
  autosave_saved: "Saved",
  autosave_unsaved: "Unsaved",
  card_content_title: "Content",
  card_content_subtitle: "Description, category, and rich body",
  card_config_title: "Configuration",
  card_config_subtitle: "Schedule, rewards, moderation, and danger zone",
  section_content_label: "Content",
  section_content_hint: "Markdown supported",
  section_schedule_label: "Schedule",
  section_participation_label: "Participation & Rewards",
  section_dependencies_label: "Dependency Actions",
  section_status_label: "Status",
  section_moderation_label: "Moderation",
  section_danger_label: "Danger zone",
  title_label: "Title",
  title_placeholder: "Enter discussion title...",
  section_attachments_label: "Attachments",
  section_attachments_hint: "PDF, images, up to 25MB each",
  dropzone_title: "Drop files or click to browse",
  dropzone_sub: "PDF, PNG, JPG · max 25MB each",
  remove_file: "Remove file",
  schedule_starts_at: "Starts at",
  schedule_ends_at: "Ends at",
  tile_reward: "Reward (CR)",
  delete_title: "Delete this discussion",
  delete_desc: "Removes the discussion and all comments. Rewards already paid are not refunded.",
  delete_btn: "Delete discussion",
  card_index_1: "01 / 02",
  card_index_2: "02 / 02",
};

const ko: Record<keyof typeof en, string> = {
  type_badge_label: "토론",
  import_from_overview: "오버뷰 가져오기",
  footer_status: "모든 변경사항 저장됨",
  autosave_saving: "저장 중...",
  autosave_saved: "저장됨",
  autosave_unsaved: "저장 안됨",
  card_content_title: "내용",
  card_content_subtitle: "설명, 카테고리, 본문",
  card_config_title: "설정",
  card_config_subtitle: "일정, 보상, 조정, 위험 영역",
  section_content_label: "내용",
  section_content_hint: "Markdown 지원",
  section_schedule_label: "일정",
  section_participation_label: "참여 및 보상",
  section_dependencies_label: "선행 액션",
  section_status_label: "상태",
  section_moderation_label: "조정",
  section_danger_label: "위험 영역",
  title_label: "제목",
  title_placeholder: "토론 제목을 입력하세요...",
  section_attachments_label: "첨부 파일",
  section_attachments_hint: "PDF, 이미지, 각 25MB까지",
  dropzone_title: "파일을 드래그하거나 클릭하여 찾기",
  dropzone_sub: "PDF, PNG, JPG · 각 25MB까지",
  remove_file: "파일 삭제",
  schedule_starts_at: "시작",
  schedule_ends_at: "종료",
  tile_reward: "보상 (CR)",
  delete_title: "토론 삭제",
  delete_desc: "토론과 모든 댓글을 삭제합니다. 이미 지급된 보상은 환불되지 않습니다.",
  delete_btn: "토론 삭제",
  card_index_1: "01 / 02",
  card_index_2: "02 / 02",
};

export const i18n = { en, ko };

export interface DiscussionEditorI18n {
  typeBadgeLabel: string;
  importFromOverview: string;
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
  sectionScheduleLabel: string;
  sectionParticipationLabel: string;
  sectionDependenciesLabel: string;
  sectionStatusLabel: string;
  sectionModerationLabel: string;
  sectionDangerLabel: string;
  titleLabel: string;
  titlePlaceholder: string;
  sectionAttachmentsLabel: string;
  sectionAttachmentsHint: string;
  dropzoneTitle: string;
  dropzoneSub: string;
  removeFile: string;
  scheduleStartsAt: string;
  scheduleEndsAt: string;
  tileReward: string;
  deleteTitle: string;
  deleteDesc: string;
  deleteBtn: string;
  cardIndex1: string;
  cardIndex2: string;
}

export function useDiscussionEditorI18n(): DiscussionEditorI18n {
  const { t } = useTranslation("discussionEditor");
  return {
    typeBadgeLabel: t("type_badge_label"),
    importFromOverview: t("import_from_overview"),
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
    sectionScheduleLabel: t("section_schedule_label"),
    sectionParticipationLabel: t("section_participation_label"),
    sectionDependenciesLabel: t("section_dependencies_label"),
    sectionStatusLabel: t("section_status_label"),
    sectionModerationLabel: t("section_moderation_label"),
    sectionDangerLabel: t("section_danger_label"),
    titleLabel: t("title_label"),
    titlePlaceholder: t("title_placeholder"),
    sectionAttachmentsLabel: t("section_attachments_label"),
    sectionAttachmentsHint: t("section_attachments_hint"),
    dropzoneTitle: t("dropzone_title"),
    dropzoneSub: t("dropzone_sub"),
    removeFile: t("remove_file"),
    scheduleStartsAt: t("schedule_starts_at"),
    scheduleEndsAt: t("schedule_ends_at"),
    tileReward: t("tile_reward"),
    deleteTitle: t("delete_title"),
    deleteDesc: t("delete_desc"),
    deleteBtn: t("delete_btn"),
    cardIndex1: t("card_index_1"),
    cardIndex2: t("card_index_2"),
  };
}
