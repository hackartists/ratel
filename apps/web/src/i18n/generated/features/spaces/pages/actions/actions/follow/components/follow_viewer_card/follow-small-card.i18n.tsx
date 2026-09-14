// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/spaces/pages/actions/actions/follow/components/follow_viewer_card/follow_small_card.rs (`FollowSmallCardTranslate`). Namespace "followSmallCard".
import { useTranslation } from "react-i18next";

const en = {
  suggested_profiles: "Suggested Profiles",
  no_profiles: "No profiles to follow.",
  featured_profile: "Featured profile",
};

const ko: Record<keyof typeof en, string> = {
  suggested_profiles: "추천 프로필",
  no_profiles: "팔로우할 프로필이 없습니다.",
  featured_profile: "대표 프로필",
};

export const i18n = { en, ko };

export interface FollowSmallCardI18n {
  suggestedProfiles: string;
  noProfiles: string;
  featuredProfile: string;
}

export function useFollowSmallCardI18n(): FollowSmallCardI18n {
  const { t } = useTranslation("followSmallCard");
  return {
    suggestedProfiles: t("suggested_profiles"),
    noProfiles: t("no_profiles"),
    featuredProfile: t("featured_profile"),
  };
}
