// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/spaces/pages/actions/actions/follow/components/follow_viewer_card/follow_full_card.rs (`FollowFullCardTranslate`). Namespace "followFullCard".
import { useTranslation } from "react-i18next";

const en = {
  suggested_for_you: "Suggested for you",
  featured_profile: "Featured profile",
};

const ko: Record<keyof typeof en, string> = {
  suggested_for_you: "Suggested for you",
  featured_profile: "대표 프로필",
};

export const i18n = { en, ko };

export interface FollowFullCardI18n {
  suggestedForYou: string;
  featuredProfile: string;
}

export function useFollowFullCardI18n(): FollowFullCardI18n {
  const { t } = useTranslation("followFullCard");
  return {
    suggestedForYou: t("suggested_for_you"),
    featuredProfile: t("featured_profile"),
  };
}
