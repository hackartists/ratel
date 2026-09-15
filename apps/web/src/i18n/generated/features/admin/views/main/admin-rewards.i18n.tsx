// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/admin/views/main/i18n.rs (`AdminRewardsTranslate`). Namespace "adminRewards".
import { useTranslation } from "react-i18next";

const en = {
  title: "Reward Management",
  tab_rules: "Reward Rules",
  add_reward: "Add Reward",
  edit_reward: "Edit Reward",
  action_label: "Reward Action",
  point: "Points",
  period: "Period",
  condition: "Condition",
  condition_value: "Value",
  actions: "Actions",
  save: "Save",
  cancel: "Cancel",
  edit: "Edit",
  no_rewards: "No rewards configured",
  enterprise_title: "Enterprise Membership Grant",
  enterprise_description: "Grant an Enterprise membership with 1,000,000 credits and 1,000 max credits per space.",
  target_type: "Target Type",
  target_user: "User",
  target_team: "Team",
  username: "Username",
  username_placeholder: "Enter username",
  grant_enterprise: "Grant Enterprise",
  grant_success: "Enterprise membership granted successfully.",
  grant_failed: "Failed to grant enterprise membership",
  enterprise_granted_list: "Granted Enterprise Memberships",
  enterprise_granted_empty: "No enterprise memberships have been granted yet.",
  granted_credits: "Granted Credits",
  max_credit: "Max Credit",
  loading: "Loading...",
  error: "Failed to load rewards",
};

const ko: Record<keyof typeof en, string> = {
  title: "리워드 관리",
  tab_rules: "리워드 규칙",
  add_reward: "리워드 추가",
  edit_reward: "리워드 수정",
  action_label: "리워드 행동",
  point: "포인트",
  period: "기간",
  condition: "조건",
  condition_value: "값",
  actions: "관리",
  save: "저장",
  cancel: "취소",
  edit: "수정",
  no_rewards: "설정된 리워드가 없습니다",
  enterprise_title: "엔터프라이즈 멤버십 부여",
  enterprise_description: "1,000,000 크레딧과 스페이스당 최대 1,000 크레딧을 가진 엔터프라이즈 멤버십을 부여합니다.",
  target_type: "대상 타입",
  target_user: "유저",
  target_team: "팀",
  username: "유저네임",
  username_placeholder: "유저네임을 입력하세요",
  grant_enterprise: "엔터프라이즈 부여",
  grant_success: "엔터프라이즈 멤버십을 부여했습니다.",
  grant_failed: "엔터프라이즈 멤버십 부여에 실패했습니다",
  enterprise_granted_list: "부여된 엔터프라이즈 멤버십",
  enterprise_granted_empty: "아직 부여된 엔터프라이즈 멤버십이 없습니다.",
  granted_credits: "부여된 크레딧",
  max_credit: "최대 크레딧",
  loading: "로딩 중...",
  error: "리워드 로딩 실패",
};

export const i18n = { en, ko };

export interface AdminRewardsI18n {
  title: string;
  tabRules: string;
  addReward: string;
  editReward: string;
  actionLabel: string;
  point: string;
  period: string;
  condition: string;
  conditionValue: string;
  actions: string;
  save: string;
  cancel: string;
  edit: string;
  noRewards: string;
  enterpriseTitle: string;
  enterpriseDescription: string;
  targetType: string;
  targetUser: string;
  targetTeam: string;
  username: string;
  usernamePlaceholder: string;
  grantEnterprise: string;
  grantSuccess: string;
  grantFailed: string;
  enterpriseGrantedList: string;
  enterpriseGrantedEmpty: string;
  grantedCredits: string;
  maxCredit: string;
  loading: string;
  error: string;
}

export function useAdminRewardsI18n(): AdminRewardsI18n {
  const { t } = useTranslation("adminRewards");
  return {
    title: t("title"),
    tabRules: t("tab_rules"),
    addReward: t("add_reward"),
    editReward: t("edit_reward"),
    actionLabel: t("action_label"),
    point: t("point"),
    period: t("period"),
    condition: t("condition"),
    conditionValue: t("condition_value"),
    actions: t("actions"),
    save: t("save"),
    cancel: t("cancel"),
    edit: t("edit"),
    noRewards: t("no_rewards"),
    enterpriseTitle: t("enterprise_title"),
    enterpriseDescription: t("enterprise_description"),
    targetType: t("target_type"),
    targetUser: t("target_user"),
    targetTeam: t("target_team"),
    username: t("username"),
    usernamePlaceholder: t("username_placeholder"),
    grantEnterprise: t("grant_enterprise"),
    grantSuccess: t("grant_success"),
    grantFailed: t("grant_failed"),
    enterpriseGrantedList: t("enterprise_granted_list"),
    enterpriseGrantedEmpty: t("enterprise_granted_empty"),
    grantedCredits: t("granted_credits"),
    maxCredit: t("max_credit"),
    loading: t("loading"),
    error: t("error"),
  };
}
