// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/spaces/pages/actions/actions/follow/components/follow_user_list/i18n.rs (`FollowUserListTranslate`). Namespace "followUserList".
import { useTranslation } from "react-i18next";

const en = {
  title: "Follow Users",
  subscribe: "Follow",
  unsubscribe: "Unfollow",
  subscribed: "Following",
  subscribed_toast: "Followed.",
  unsubscribed_toast: "Unfollowed.",
  remove: "Remove",
  empty: "No users yet.",
  creator_badge: "Creator",
};

const ko: Record<keyof typeof en, string> = {
  title: "팔로우 유저",
  subscribe: "Follow",
  unsubscribe: "Unfollow",
  subscribed: "Following",
  subscribed_toast: "팔로우되었습니다.",
  unsubscribed_toast: "언팔로우되었습니다.",
  remove: "Remove",
  empty: "등록된 유저가 없습니다.",
  creator_badge: "Creator",
};

export const i18n = { en, ko };

export interface FollowUserListI18n {
  title: string;
  subscribe: string;
  unsubscribe: string;
  subscribed: string;
  subscribedToast: string;
  unsubscribedToast: string;
  remove: string;
  empty: string;
  creatorBadge: string;
}

export function useFollowUserListI18n(): FollowUserListI18n {
  const { t } = useTranslation("followUserList");
  return {
    title: t("title"),
    subscribe: t("subscribe"),
    unsubscribe: t("unsubscribe"),
    subscribed: t("subscribed"),
    subscribedToast: t("subscribed_toast"),
    unsubscribedToast: t("unsubscribed_toast"),
    remove: t("remove"),
    empty: t("empty"),
    creatorBadge: t("creator_badge"),
  };
}
