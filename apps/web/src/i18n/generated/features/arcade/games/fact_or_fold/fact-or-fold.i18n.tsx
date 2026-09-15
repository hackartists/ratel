// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/arcade/games/fact_or_fold/i18n.rs (`FactOrFoldTranslate`). Namespace "factOrFold".
import { useTranslation } from "react-i18next";

const en = {
  arcade_brand: "RATEL ARCADE",
  feature_title: "Fact or Fold",
};

const ko: Record<keyof typeof en, string> = {
  arcade_brand: "라텔 오락실",
  feature_title: "Fact or Fold",
};

export const i18n = { en, ko };

export interface FactOrFoldI18n {
  arcadeBrand: string;
  featureTitle: string;
}

export function useFactOrFoldI18n(): FactOrFoldI18n {
  const { t } = useTranslation("factOrFold");
  return {
    arcadeBrand: t("arcade_brand"),
    featureTitle: t("feature_title"),
  };
}
