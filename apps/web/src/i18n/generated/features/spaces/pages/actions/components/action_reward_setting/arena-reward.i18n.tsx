// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/spaces/pages/actions/components/action_reward_setting/component.rs (`ArenaRewardTranslate`). Namespace "arenaReward".
import { useTranslation } from "react-i18next";

const en = {
  reward: "Reward",
  unlock: "Unlock",
  default_reward: "Default Reward",
  action_point_reward: "Action Point Reward",
  boost_label: "Boost",
  boost_multiplier: "Boost Multiplier Settings",
  credit_usage: "Credit Usage",
  max_credits: "Max Credits",
  remaining_credits: "Remaining Credits",
  point_boost: "Point & Boost",
  point_boost_line_one: "Points are rewarded to participants when they complete the action.",
  point_boost_line_two: "Boost multiplies the base reward points by the set multiplier.",
  point_boost_line_three: "Credits are consumed when boost is applied to an action.",
  locked_started: "Rewards cannot be changed after the action has started.",
  reward_updated: "Reward credits updated.",
};

const ko: Record<keyof typeof en, string> = {
  reward: "보상",
  unlock: "잠금 해제",
  default_reward: "기본 보상",
  action_point_reward: "액션 포인트 보상",
  boost_label: "부스트",
  boost_multiplier: "부스트 배율 설정",
  credit_usage: "크레딧 사용량",
  max_credits: "최대 크레딧",
  remaining_credits: "잔여 크레딧",
  point_boost: "포인트 & 부스트",
  point_boost_line_one: "포인트는 참여자가 액션을 완료하면 지급됩니다.",
  point_boost_line_two: "부스트는 기본 보상 포인트에 설정된 배율을 곱합니다.",
  point_boost_line_three: "액션에 부스트를 적용하면 크레딧이 소모됩니다.",
  locked_started: "액션이 시작된 이후에는 보상을 변경할 수 없습니다.",
  reward_updated: "보상 크레딧이 업데이트되었습니다.",
};

export const i18n = { en, ko };

export interface ArenaRewardI18n {
  reward: string;
  unlock: string;
  defaultReward: string;
  actionPointReward: string;
  boostLabel: string;
  boostMultiplier: string;
  creditUsage: string;
  maxCredits: string;
  remainingCredits: string;
  pointBoost: string;
  pointBoostLineOne: string;
  pointBoostLineTwo: string;
  pointBoostLineThree: string;
  lockedStarted: string;
  rewardUpdated: string;
}

export function useArenaRewardI18n(): ArenaRewardI18n {
  const { t } = useTranslation("arenaReward");
  return {
    reward: t("reward"),
    unlock: t("unlock"),
    defaultReward: t("default_reward"),
    actionPointReward: t("action_point_reward"),
    boostLabel: t("boost_label"),
    boostMultiplier: t("boost_multiplier"),
    creditUsage: t("credit_usage"),
    maxCredits: t("max_credits"),
    remainingCredits: t("remaining_credits"),
    pointBoost: t("point_boost"),
    pointBoostLineOne: t("point_boost_line_one"),
    pointBoostLineTwo: t("point_boost_line_two"),
    pointBoostLineThree: t("point_boost_line_three"),
    lockedStarted: t("locked_started"),
    rewardUpdated: t("reward_updated"),
  };
}
