// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/my_follower/views/home/i18n.rs (`MyFollowerTranslate`). Namespace "myFollower".
import { useTranslation } from "react-i18next";

const en = {
  follow_toast: "Followed.",
  unfollow_toast: "Unfollowed.",
};

const ko: Record<keyof typeof en, string> = {
  follow_toast: "팔로우되었습니다.",
  unfollow_toast: "언팔로우되었습니다.",
};

export const i18n = { en, ko };

export interface MyFollowerI18n {
  followToast: string;
  unfollowToast: string;
}

export function useMyFollowerI18n(): MyFollowerI18n {
  const { t } = useTranslation("myFollower");
  return {
    followToast: t("follow_toast"),
    unfollowToast: t("unfollow_toast"),
  };
}
