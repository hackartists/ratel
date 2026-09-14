// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/spaces/pages/actions/actions/meet/components/meet_page/i18n.rs (`MeetActionTranslate`). Namespace "meetAction".
import { useTranslation } from "react-i18next";

const en = {
  page_title: "Create Meet",
  mode_label: "Start mode",
  mode_scheduled: "Scheduled",
  mode_instant: "Instant · Start now",
  mode_scheduled_desc: "Opens at a set time. Participants get reminders.",
  mode_instant_desc: "Goes Live immediately. One notification to participants.",
  details_label: "Details",
  details_title_label: "Title",
  details_title_placeholder: "e.g. Mid-semester retrospective call",
  details_description_label: "Description (optional)",
  details_description_placeholder: "Agenda, materials to prepare…",
  when_label: "When",
  when_start_label: "Start time",
  when_duration_label: "Estimated duration",
  when_duration_unit_min: "min",
  settings_label: "Settings",
  submit_schedule: "Schedule Meet",
  submit_start_now: "Start now",
  coming_soon_badge: "Coming Soon",
  live_label: "Live now",
  ended_label: "Meeting ended",
  scheduled_starts_at: "Starts at",
  live_cta: "Join meeting",
  ended_cta: "View archive",
};

const ko: Record<keyof typeof en, string> = {
  page_title: "회의 생성",
  mode_label: "시작 방식",
  mode_scheduled: "예약",
  mode_instant: "즉시 시작",
  mode_scheduled_desc: "정해진 시간에 열립니다. 참가자는 리마인더를 받습니다.",
  mode_instant_desc: "즉시 Live로 전환됩니다. 참가자에게 한 번 알림 전송.",
  details_label: "세부 정보",
  details_title_label: "제목",
  details_title_placeholder: "예: 학기 중간 회고 회의",
  details_description_label: "설명 (선택)",
  details_description_placeholder: "안건, 준비할 자료…",
  when_label: "일정",
  when_start_label: "시작 시간",
  when_duration_label: "예상 지속 시간",
  when_duration_unit_min: "분",
  settings_label: "설정",
  submit_schedule: "Meet 예약",
  submit_start_now: "지금 시작",
  coming_soon_badge: "준비 중",
  live_label: "진행 중",
  ended_label: "종료됨",
  scheduled_starts_at: "시작 시간",
  live_cta: "입장",
  ended_cta: "아카이브 보기",
};

export const i18n = { en, ko };

export interface MeetActionI18n {
  pageTitle: string;
  modeLabel: string;
  modeScheduled: string;
  modeInstant: string;
  modeScheduledDesc: string;
  modeInstantDesc: string;
  detailsLabel: string;
  detailsTitleLabel: string;
  detailsTitlePlaceholder: string;
  detailsDescriptionLabel: string;
  detailsDescriptionPlaceholder: string;
  whenLabel: string;
  whenStartLabel: string;
  whenDurationLabel: string;
  whenDurationUnitMin: string;
  settingsLabel: string;
  submitSchedule: string;
  submitStartNow: string;
  comingSoonBadge: string;
  liveLabel: string;
  endedLabel: string;
  scheduledStartsAt: string;
  liveCta: string;
  endedCta: string;
}

export function useMeetActionI18n(): MeetActionI18n {
  const { t } = useTranslation("meetAction");
  return {
    pageTitle: t("page_title"),
    modeLabel: t("mode_label"),
    modeScheduled: t("mode_scheduled"),
    modeInstant: t("mode_instant"),
    modeScheduledDesc: t("mode_scheduled_desc"),
    modeInstantDesc: t("mode_instant_desc"),
    detailsLabel: t("details_label"),
    detailsTitleLabel: t("details_title_label"),
    detailsTitlePlaceholder: t("details_title_placeholder"),
    detailsDescriptionLabel: t("details_description_label"),
    detailsDescriptionPlaceholder: t("details_description_placeholder"),
    whenLabel: t("when_label"),
    whenStartLabel: t("when_start_label"),
    whenDurationLabel: t("when_duration_label"),
    whenDurationUnitMin: t("when_duration_unit_min"),
    settingsLabel: t("settings_label"),
    submitSchedule: t("submit_schedule"),
    submitStartNow: t("submit_start_now"),
    comingSoonBadge: t("coming_soon_badge"),
    liveLabel: t("live_label"),
    endedLabel: t("ended_label"),
    scheduledStartsAt: t("scheduled_starts_at"),
    liveCta: t("live_cta"),
    endedCta: t("ended_cta"),
  };
}
