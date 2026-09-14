// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/character/components/reward_breakdown_chip/i18n.rs (`RewardBreakdownChipTranslate`). Namespace "rewardBreakdownChip".
import { useTranslation } from "react-i18next";

const en = {
  base_label: "Base",
  money_tree_short: "Money Tree",
  money_tree_max: "MAX",
};

const ko: Record<keyof typeof en, string> = {
  base_label: "기본",
  money_tree_short: "머니트리",
  money_tree_max: "MAX",
};

export const i18n = { en, ko };

export interface RewardBreakdownChipI18n {
  baseLabel: string;
  moneyTreeShort: string;
  moneyTreeMax: string;
}

export function useRewardBreakdownChipI18n(): RewardBreakdownChipI18n {
  const { t } = useTranslation("rewardBreakdownChip");
  return {
    baseLabel: t("base_label"),
    moneyTreeShort: t("money_tree_short"),
    moneyTreeMax: t("money_tree_max"),
  };
}
