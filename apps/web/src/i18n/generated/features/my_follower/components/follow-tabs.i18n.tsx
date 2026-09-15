// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/my_follower/components/i18n.rs (`FollowTabsTranslate`). Namespace "followTabs".
import { useTranslation } from "react-i18next";

const en = {
  followers: "Followers",
  followings: "Followings",
};

const ko: Record<keyof typeof en, string> = {
  followers: "팔로워",
  followings: "팔로잉",
};

export const i18n = { en, ko };

export interface FollowTabsI18n {
  followers: string;
  followings: string;
}

export function useFollowTabsI18n(): FollowTabsI18n {
  const { t } = useTranslation("followTabs");
  return {
    followers: t("followers"),
    followings: t("followings"),
  };
}
