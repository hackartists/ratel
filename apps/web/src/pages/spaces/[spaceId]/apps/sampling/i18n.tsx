/** Strings of the Sampling app settings and dashboard. Namespace "spaceSampling". */
import { useTranslation } from "react-i18next";

const en = {
  breadcrumb_apps: "Apps",
  breadcrumb_sampling: "Sampling",
  type_badge: "Sampling",
  topbar_title: "Sampling settings",
  back_aria: "Go back",
  viewer_no_access: "Only the space creator can manage sampling.",
  viewer_back: "Go back",
  locked_notice: "Sampling has started. The settings are locked.",
  entry_poll_label: "Entry poll",
  entry_poll_hint: "The prerequisite poll whose answers build the population.",
  no_entry_poll: "Add a prerequisite poll first. Its answers build the population.",
  population_label: "Population conditions",
  population_hint: "Respondents must match every condition (any of the selected values within a condition).",
  dimensions_label: "Sampling items",
  dimensions_hint: "Each combination of the selected questions' options becomes a sample group.",
  no_single_choice: "The entry poll has no single-choice questions.",
  unique_label: "Duplicate prevention",
  unique_hint: "Members whose answer to any selected question matches an admitted member cannot enter. Spaces, hyphens and letter case are ignored; blank answers are not checked.",
  no_short_answer: "The entry poll has no short-answer questions.",
  total_label: "Sample size",
  total_hint: "Total number of participants to sample.",
  allocation_label: "Allocation: Equal allocation",
  allocation_hint: "Each group gets the same target; the remainder goes to the first groups.",
  method_label: "Selection method",
  method_first_come_hint: "Population members take seats in the order they enter during Sampling.",
  method_random_hint: "Members are drawn at random per group when Sampling starts.",
  recruit_label: "Allow recruiting during Sampling",
  recruit_hint: "New participants can still join and answer the entry poll while sampling.",
  preview_label: "Target per group",
  preview_empty: "Choose an entry poll and a sample size to see the targets.",
  col_group: "Group",
  col_target: "Target",
  col_population: "Population",
  col_selected: "Selected",
  col_entered: "Entered",
  col_status: "Status",
  total_row: "Total",
  all_respondents: "All respondents",
  save: "Save",
  saving: "Saving...",
  saved: "Sampling settings saved.",
  dashboard_label: "Sampling dashboard",
  dashboard_hint: "Targets and progress for each sample group.",
  refresh: "Refresh",
  shortage: "Population short",
  filled: "Filled",
  in_progress: "In progress",
};

const ko: Record<keyof typeof en, string> = {
  breadcrumb_apps: "앱",
  breadcrumb_sampling: "표본 추출",
  type_badge: "표본 추출",
  topbar_title: "표본 추출 설정",
  back_aria: "뒤로 가기",
  viewer_no_access: "표본 추출은 스페이스 생성자만 관리할 수 있습니다.",
  viewer_back: "뒤로 가기",
  locked_notice: "표본 추출이 시작되어 설정을 변경할 수 없습니다.",
  entry_poll_label: "엔트리 폴",
  entry_poll_hint: "응답으로 모집단을 구성할 사전 참여 설문입니다.",
  no_entry_poll: "먼저 사전 참여 설문을 추가하세요. 그 응답으로 모집단을 구성합니다.",
  population_label: "모집단 조건",
  population_hint: "응답자는 모든 조건을 충족해야 합니다(조건 내 선택한 값 중 하나).",
  dimensions_label: "표본 추출 항목",
  dimensions_hint: "선택한 문항의 선택지 조합마다 하나의 표본 그룹이 됩니다.",
  no_single_choice: "엔트리 폴에 단일 선택 문항이 없습니다.",
  unique_label: "중복 참여 방지",
  unique_hint: "선택한 문항 중 하나라도 이미 참여한 사람과 답이 같으면 입장할 수 없습니다. 공백, 하이픈, 대소문자는 구분하지 않으며 빈 답은 검사하지 않습니다.",
  no_short_answer: "엔트리 폴에 단답형 문항이 없습니다.",
  total_label: "표본 수",
  total_hint: "추출할 전체 참여자 수입니다.",
  allocation_label: "표본 배분 방식: 균등 배분",
  allocation_hint: "각 그룹에 같은 목표를 배정하고, 나머지는 앞 그룹부터 1명씩 더합니다.",
  method_label: "추출 방법",
  method_first_come_hint: "Sampling 중 입장하는 순서대로 각 그룹의 자리를 채웁니다.",
  method_random_hint: "Sampling 시작 시 그룹별로 무작위 추출합니다.",
  recruit_label: "Sampling 중 모집 허용",
  recruit_hint: "표본 추출 중에도 새 참여자가 참여해 엔트리 폴에 응답할 수 있습니다.",
  preview_label: "그룹별 목표",
  preview_empty: "엔트리 폴과 표본 수를 입력하면 목표가 표시됩니다.",
  col_group: "그룹",
  col_target: "목표",
  col_population: "모집단",
  col_selected: "선정",
  col_entered: "입장",
  col_status: "상태",
  total_row: "합계",
  all_respondents: "전체 응답자",
  save: "저장",
  saving: "저장 중...",
  saved: "Sampling 설정이 저장되었습니다.",
  dashboard_label: "표본 추출 대시보드",
  dashboard_hint: "표본 그룹별 목표와 진행 현황입니다.",
  refresh: "새로고침",
  shortage: "모집단 부족",
  filled: "확보 완료",
  in_progress: "진행 중",
};

export const i18n = { en, ko };

export interface SpaceSamplingI18n {
  breadcrumbApps: string;
  breadcrumbSampling: string;
  typeBadge: string;
  topbarTitle: string;
  backAria: string;
  viewerNoAccess: string;
  viewerBack: string;
  lockedNotice: string;
  entryPollLabel: string;
  entryPollHint: string;
  noEntryPoll: string;
  populationLabel: string;
  populationHint: string;
  dimensionsLabel: string;
  dimensionsHint: string;
  noSingleChoice: string;
  uniqueLabel: string;
  uniqueHint: string;
  noShortAnswer: string;
  totalLabel: string;
  totalHint: string;
  allocationLabel: string;
  allocationHint: string;
  methodLabel: string;
  methodFirstComeHint: string;
  methodRandomHint: string;
  recruitLabel: string;
  recruitHint: string;
  previewLabel: string;
  previewEmpty: string;
  colGroup: string;
  colTarget: string;
  colPopulation: string;
  colSelected: string;
  colEntered: string;
  colStatus: string;
  totalRow: string;
  allRespondents: string;
  save: string;
  saving: string;
  saved: string;
  dashboardLabel: string;
  dashboardHint: string;
  refresh: string;
  shortage: string;
  filled: string;
  inProgress: string;
}

export function useSpaceSamplingI18n(): SpaceSamplingI18n {
  const { t } = useTranslation("spaceSampling");
  return {
    breadcrumbApps: t("breadcrumb_apps"),
    breadcrumbSampling: t("breadcrumb_sampling"),
    typeBadge: t("type_badge"),
    topbarTitle: t("topbar_title"),
    backAria: t("back_aria"),
    viewerNoAccess: t("viewer_no_access"),
    viewerBack: t("viewer_back"),
    lockedNotice: t("locked_notice"),
    entryPollLabel: t("entry_poll_label"),
    entryPollHint: t("entry_poll_hint"),
    noEntryPoll: t("no_entry_poll"),
    populationLabel: t("population_label"),
    populationHint: t("population_hint"),
    dimensionsLabel: t("dimensions_label"),
    dimensionsHint: t("dimensions_hint"),
    noSingleChoice: t("no_single_choice"),
    uniqueLabel: t("unique_label"),
    uniqueHint: t("unique_hint"),
    noShortAnswer: t("no_short_answer"),
    totalLabel: t("total_label"),
    totalHint: t("total_hint"),
    allocationLabel: t("allocation_label"),
    allocationHint: t("allocation_hint"),
    methodLabel: t("method_label"),
    methodFirstComeHint: t("method_first_come_hint"),
    methodRandomHint: t("method_random_hint"),
    recruitLabel: t("recruit_label"),
    recruitHint: t("recruit_hint"),
    previewLabel: t("preview_label"),
    previewEmpty: t("preview_empty"),
    colGroup: t("col_group"),
    colTarget: t("col_target"),
    colPopulation: t("col_population"),
    colSelected: t("col_selected"),
    colEntered: t("col_entered"),
    colStatus: t("col_status"),
    totalRow: t("total_row"),
    allRespondents: t("all_respondents"),
    save: t("save"),
    saving: t("saving"),
    saved: t("saved"),
    dashboardLabel: t("dashboard_label"),
    dashboardHint: t("dashboard_hint"),
    refresh: t("refresh"),
    shortage: t("shortage"),
    filled: t("filled"),
    inProgress: t("in_progress"),
  };
}
