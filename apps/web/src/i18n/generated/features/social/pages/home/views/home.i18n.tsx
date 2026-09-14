// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/social/pages/home/views/i18n.rs (`HomeTranslate`). Namespace "home".
import { useTranslation } from "react-i18next";

const en = {
  team_label: "Team",
  posts_label: "Posts",
  posts_loaded: "Posts",
  likes_label: "Likes",
  comments_label: "Comments",
  on_page_label: "on page",
  create_post: "Create Post",
  all_label: "All",
  since_label: "Since",
  no_description: "No team description yet.",
  no_posts: "No posts yet",
  no_posts_desc: "Team activity will appear here once posts are created.",
};

const ko: Record<keyof typeof en, string> = {
  team_label: "팀",
  posts_label: "게시글",
  posts_loaded: "게시글",
  likes_label: "좋아요",
  comments_label: "댓글",
  on_page_label: "페이지",
  create_post: "게시글 작성",
  all_label: "전체",
  since_label: "개설일",
  no_description: "팀 소개가 아직 등록되지 않았습니다.",
  no_posts: "게시글이 없습니다",
  no_posts_desc: "게시글이 등록되면 이곳에 표시됩니다.",
};

export const i18n = { en, ko };

export interface HomeI18n {
  teamLabel: string;
  postsLabel: string;
  postsLoaded: string;
  likesLabel: string;
  commentsLabel: string;
  onPageLabel: string;
  createPost: string;
  allLabel: string;
  sinceLabel: string;
  noDescription: string;
  noPosts: string;
  noPostsDesc: string;
}

export function useHomeI18n(): HomeI18n {
  const { t } = useTranslation("home");
  return {
    teamLabel: t("team_label"),
    postsLabel: t("posts_label"),
    postsLoaded: t("posts_loaded"),
    likesLabel: t("likes_label"),
    commentsLabel: t("comments_label"),
    onPageLabel: t("on_page_label"),
    createPost: t("create_post"),
    allLabel: t("all_label"),
    sinceLabel: t("since_label"),
    noDescription: t("no_description"),
    noPosts: t("no_posts"),
    noPostsDesc: t("no_posts_desc"),
  };
}
