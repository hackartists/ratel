// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/spaces/pages/actions/actions/follow/views/main/creator/i18n.rs (`FollowCreatorTranslate`). Namespace "followCreator".
import { useTranslation } from "react-i18next";

const en = {
  title: "Follow",
  tab_general: "General",
  tab_common: "Settings",
  btn_back: "Back",
  type_badge_label: "Follow",
  footer_status: "All changes saved",
  autosave_saving: "Saving...",
  autosave_saved: "Saved",
  autosave_unsaved: "Unsaved",
  card_targets_title: "Targets",
  card_targets_subtitle: "Title and the users to follow",
  section_content_label: "Content",
  title_label: "Title",
  title_placeholder: "Enter follow action title...",
  card_config_title: "Configuration",
  card_config_subtitle: "Schedule, rewards, and danger zone",
  section_targets_label: "Targets",
  section_targets_hint: "At least 1 · up to 20",
  section_schedule_label: "Schedule",
  schedule_starts_at: "Starts at",
  schedule_ends_at: "Ends at",
  section_participation_label: "Participation & Rewards",
  section_dependencies_label: "Dependency Actions",
  section_status_label: "Status",
  section_danger_label: "Danger zone",
  tile_reward: "Reward (CR)",
  delete_title: "Delete this follow action",
  delete_desc: "Removes the follow action and all completion records.",
  delete_btn: "Delete follow",
  card_index_1: "01 / 02",
  card_index_2: "02 / 02",
};

const ko: Record<keyof typeof en, string> = {
  title: "팔로우",
  tab_general: "일반",
  tab_common: "설정",
  btn_back: "뒤로",
  type_badge_label: "팔로우",
  footer_status: "모든 변경사항 저장됨",
  autosave_saving: "저장 중...",
  autosave_saved: "저장됨",
  autosave_unsaved: "저장 안됨",
  card_targets_title: "대상",
  card_targets_subtitle: "제목 및 팔로우할 사용자",
  section_content_label: "내용",
  title_label: "제목",
  title_placeholder: "Follow 액션 제목 입력...",
  card_config_title: "설정",
  card_config_subtitle: "일정, 보상, 위험 영역",
  section_targets_label: "대상",
  section_targets_hint: "최소 1 · 최대 20",
  section_schedule_label: "일정",
  schedule_starts_at: "시작",
  schedule_ends_at: "종료",
  section_participation_label: "참여 및 보상",
  section_dependencies_label: "선행 액션",
  section_status_label: "상태",
  section_danger_label: "위험 영역",
  tile_reward: "보상 (CR)",
  delete_title: "Follow 액션 삭제",
  delete_desc: "Follow 액션과 완료 기록을 삭제합니다.",
  delete_btn: "Follow 삭제",
  card_index_1: "01 / 02",
  card_index_2: "02 / 02",
};

export const i18n = { en, ko };

export interface FollowCreatorI18n {
  title: string;
  tabGeneral: string;
  tabCommon: string;
  btnBack: string;
  typeBadgeLabel: string;
  footerStatus: string;
  autosaveSaving: string;
  autosaveSaved: string;
  autosaveUnsaved: string;
  cardTargetsTitle: string;
  cardTargetsSubtitle: string;
  sectionContentLabel: string;
  titleLabel: string;
  titlePlaceholder: string;
  cardConfigTitle: string;
  cardConfigSubtitle: string;
  sectionTargetsLabel: string;
  sectionTargetsHint: string;
  sectionScheduleLabel: string;
  scheduleStartsAt: string;
  scheduleEndsAt: string;
  sectionParticipationLabel: string;
  sectionDependenciesLabel: string;
  sectionStatusLabel: string;
  sectionDangerLabel: string;
  tileReward: string;
  deleteTitle: string;
  deleteDesc: string;
  deleteBtn: string;
  cardIndex1: string;
  cardIndex2: string;
}

export function useFollowCreatorI18n(): FollowCreatorI18n {
  const { t } = useTranslation("followCreator");
  return {
    title: t("title"),
    tabGeneral: t("tab_general"),
    tabCommon: t("tab_common"),
    btnBack: t("btn_back"),
    typeBadgeLabel: t("type_badge_label"),
    footerStatus: t("footer_status"),
    autosaveSaving: t("autosave_saving"),
    autosaveSaved: t("autosave_saved"),
    autosaveUnsaved: t("autosave_unsaved"),
    cardTargetsTitle: t("card_targets_title"),
    cardTargetsSubtitle: t("card_targets_subtitle"),
    sectionContentLabel: t("section_content_label"),
    titleLabel: t("title_label"),
    titlePlaceholder: t("title_placeholder"),
    cardConfigTitle: t("card_config_title"),
    cardConfigSubtitle: t("card_config_subtitle"),
    sectionTargetsLabel: t("section_targets_label"),
    sectionTargetsHint: t("section_targets_hint"),
    sectionScheduleLabel: t("section_schedule_label"),
    scheduleStartsAt: t("schedule_starts_at"),
    scheduleEndsAt: t("schedule_ends_at"),
    sectionParticipationLabel: t("section_participation_label"),
    sectionDependenciesLabel: t("section_dependencies_label"),
    sectionStatusLabel: t("section_status_label"),
    sectionDangerLabel: t("section_danger_label"),
    tileReward: t("tile_reward"),
    deleteTitle: t("delete_title"),
    deleteDesc: t("delete_desc"),
    deleteBtn: t("delete_btn"),
    cardIndex1: t("card_index_1"),
    cardIndex2: t("card_index_2"),
  };
}
