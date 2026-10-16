/** Strings of the participant-facing Sampling card. Namespace "samplingEntryCard". */
import { useTranslation } from "react-i18next";

const en = {
  title: "Sample selection",
  group: "Your group",
  not_answered: "Answer the entry poll to join the population.",
  recruit_closed: "Recruitment has closed.",
  not_eligible: "You do not meet the population conditions, so you cannot take part in this space.",
  waiting: "You can enter once sampling starts.",
  can_enter: "Enter now to be confirmed as a sample.",
  cell_full: "Your sample group is already full, so you cannot enter.",
  selected: "You were selected for the sample. Please enter.",
  not_selected: "You were not selected for the sample, so you cannot enter.",
  entered: "You can take part once the space starts.",
  entered_heading: "Congratulations! You were selected for the sample.",
  cell_full_heading: "First-come seats are all taken",
  not_selected_heading: "Not selected for the sample",
  sample_closed: "Sample recruitment has ended, so you can no longer take part.",
  participation_open: "Sampling is over; this space is open to everyone who completed the entry poll.",
  enter: "Enter",
  entering: "Entering...",
};

const ko: Record<keyof typeof en, string> = {
  title: "표본 선정",
  group: "내 그룹",
  not_answered: "엔트리 폴에 응답하면 모집단에 포함됩니다.",
  recruit_closed: "모집이 종료되었습니다.",
  not_eligible: "모집단 조건을 충족하지 않아 이 스페이스에 참여할 수 없습니다.",
  waiting: "표본 추출이 시작되면 입장할 수 있습니다.",
  can_enter: "지금 입장하면 표본으로 확정됩니다.",
  cell_full: "해당 표본 그룹의 모집이 마감되어 입장할 수 없습니다.",
  selected: "표본으로 선정되었습니다. 입장해 주세요.",
  not_selected: "표본으로 선정되지 않아 입장할 수 없습니다.",
  entered: "스페이스가 시작되면 참여할 수 있습니다.",
  entered_heading: "축하합니다! 표본으로 선정되었습니다.",
  cell_full_heading: "선착순 모집이 마감되었습니다",
  not_selected_heading: "표본으로 선정되지 않았습니다",
  sample_closed: "표본 모집이 종료되어 더 이상 참여할 수 없습니다.",
  participation_open: "표본 추출이 끝났습니다. 엔트리 폴을 완료한 모든 참여자가 참여할 수 있습니다.",
  enter: "입장",
  entering: "입장 중...",
};

export const i18n = { en, ko };

export interface SamplingEntryCardI18n {
  title: string;
  group: string;
  notAnswered: string;
  recruitClosed: string;
  notEligible: string;
  waiting: string;
  canEnter: string;
  cellFull: string;
  selected: string;
  notSelected: string;
  entered: string;
  enteredHeading: string;
  cellFullHeading: string;
  notSelectedHeading: string;
  sampleClosed: string;
  participationOpen: string;
  enter: string;
  entering: string;
}

export function useSamplingEntryCardI18n(): SamplingEntryCardI18n {
  const { t } = useTranslation("samplingEntryCard");
  return {
    title: t("title"),
    group: t("group"),
    notAnswered: t("not_answered"),
    recruitClosed: t("recruit_closed"),
    notEligible: t("not_eligible"),
    waiting: t("waiting"),
    canEnter: t("can_enter"),
    cellFull: t("cell_full"),
    selected: t("selected"),
    notSelected: t("not_selected"),
    entered: t("entered"),
    enteredHeading: t("entered_heading"),
    cellFullHeading: t("cell_full_heading"),
    notSelectedHeading: t("not_selected_heading"),
    sampleClosed: t("sample_closed"),
    participationOpen: t("participation_open"),
    enter: t("enter"),
    entering: t("entering"),
  };
}
