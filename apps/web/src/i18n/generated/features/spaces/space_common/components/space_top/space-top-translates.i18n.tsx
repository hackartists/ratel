// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/spaces/space_common/components/space_top/mod.rs (`SpaceTopTranslates`). Namespace "spaceTopTranslates".
import { useTranslation } from "react-i18next";

const en = {
  publish: "Publish",
  start: "Start",
  finish: "Finish",
  preview: "Preview",
  design: "Design",
  go_home: "Go Home",
  participant_button_label: "Participate",
  status_draft: "Draft",
  status_in_progress: "In Progress",
  status_started: "Started",
  status_finished: "Finished",
};

const ko: Record<keyof typeof en, string> = {
  publish: "게시하기",
  start: "시작하기",
  finish: "종료하기",
  preview: "미리보기",
  design: "설계하기",
  go_home: "홈으로 이동",
  participant_button_label: "참여하기",
  status_draft: "초안",
  status_in_progress: "진행 중",
  status_started: "시작됨",
  status_finished: "종료",
};

export const i18n = { en, ko };

export interface SpaceTopTranslatesI18n {
  publish: string;
  start: string;
  finish: string;
  preview: string;
  design: string;
  goHome: string;
  participantButtonLabel: string;
  statusDraft: string;
  statusInProgress: string;
  statusStarted: string;
  statusFinished: string;
}

export function useSpaceTopTranslatesI18n(): SpaceTopTranslatesI18n {
  const { t } = useTranslation("spaceTopTranslates");
  return {
    publish: t("publish"),
    start: t("start"),
    finish: t("finish"),
    preview: t("preview"),
    design: t("design"),
    goHome: t("go_home"),
    participantButtonLabel: t("participant_button_label"),
    statusDraft: t("status_draft"),
    statusInProgress: t("status_in_progress"),
    statusStarted: t("status_started"),
    statusFinished: t("status_finished"),
  };
}
