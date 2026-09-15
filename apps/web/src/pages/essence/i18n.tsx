// Ported from: app/ratel/src/features/essence/pages/sources/i18n.rs (`EssenceSourcesTranslate`). Namespace "essenceSources".
import { useTranslation } from "react-i18next";

const en = {
  seo_title: "Ratel — Essence Sources",
  back_label: "Back",
  topbar_eyebrow: "Essence",
  topbar_main: "Sources",
  hero_eyebrow: "Your Essence",
  hero_subtitle: "Everything you've authored across Ratel — posts, comments, polls, quizzes — indexed into your Essence House.",
  hero_sources_word: "sources",
  hero_words_word: "words",
  kind_all: "All",
  kind_notion: "Notion",
  kind_post: "Posts",
  kind_comment: "Comments",
  kind_poll: "Polls",
  kind_quiz: "Quizzes",
  search_placeholder: "Search sources by title, content, or tag…",
  sort_last_edited: "Last edited ↓",
  sort_word_count: "Word count ↓",
  sort_title: "Title A–Z",
  bulk_selected_suffix: "selected",
  bulk_remove: "Remove",
  col_title: "Title",
  col_words: "Words",
  col_last_sync: "Last sync",
  row_select_label: "Select",
  row_more_label: "More",
  menu_delete: "Delete",
  tag_notion: "Notion",
  tag_post: "Post",
  tag_poll: "Poll",
  tag_quiz: "Quiz",
  tag_post_comment: "Post comment",
  tag_discussion_comment: "Discussion comment",
  pagination_prefix: "Showing",
  pagination_of: "of",
  pagination_previous: "Previous",
  pagination_next: "Next",
  empty_title: "No sources yet",
  empty_subtitle: "Posts, comments, polls, and quizzes you create will show up here.",
};

const ko: Record<keyof typeof en, string> = {
  seo_title: "Ratel — Essence 소스",
  back_label: "뒤로",
  topbar_eyebrow: "Essence",
  topbar_main: "소스",
  hero_eyebrow: "내 Essence",
  hero_subtitle: "내가 Ratel에 올린 모든 포스트 · 댓글 · 투표 · 퀴즈가 Essence House에 모입니다.",
  hero_sources_word: "개 소스",
  hero_words_word: "단어",
  kind_all: "전체",
  kind_notion: "Notion",
  kind_post: "포스트",
  kind_comment: "댓글",
  kind_poll: "투표",
  kind_quiz: "퀴즈",
  search_placeholder: "제목, 내용, 태그로 소스 검색…",
  sort_last_edited: "최근 편집 ↓",
  sort_word_count: "단어 수 ↓",
  sort_title: "제목순",
  bulk_selected_suffix: "개 선택됨",
  bulk_remove: "제거",
  col_title: "제목",
  col_words: "단어",
  col_last_sync: "최근 동기화",
  row_select_label: "선택",
  row_more_label: "더보기",
  menu_delete: "삭제",
  tag_notion: "Notion",
  tag_post: "포스트",
  tag_poll: "투표",
  tag_quiz: "퀴즈",
  tag_post_comment: "포스트 댓글",
  tag_discussion_comment: "토론 댓글",
  pagination_prefix: "",
  pagination_of: "/ 총",
  pagination_previous: "이전",
  pagination_next: "다음",
  empty_title: "아직 소스가 없습니다",
  empty_subtitle: "포스트 · 댓글 · 투표 · 퀴즈를 만들면 여기에 표시됩니다.",
};

export const i18n = { en, ko };

export interface EssenceSourcesI18n {
  seoTitle: string;
  backLabel: string;
  topbarEyebrow: string;
  topbarMain: string;
  heroEyebrow: string;
  heroSubtitle: string;
  heroSourcesWord: string;
  heroWordsWord: string;
  kindAll: string;
  kindNotion: string;
  kindPost: string;
  kindComment: string;
  kindPoll: string;
  kindQuiz: string;
  searchPlaceholder: string;
  sortLastEdited: string;
  sortWordCount: string;
  sortTitle: string;
  bulkSelectedSuffix: string;
  bulkRemove: string;
  colTitle: string;
  colWords: string;
  colLastSync: string;
  rowSelectLabel: string;
  rowMoreLabel: string;
  menuDelete: string;
  tagNotion: string;
  tagPost: string;
  tagPoll: string;
  tagQuiz: string;
  tagPostComment: string;
  tagDiscussionComment: string;
  paginationPrefix: string;
  paginationOf: string;
  paginationPrevious: string;
  paginationNext: string;
  emptyTitle: string;
  emptySubtitle: string;
}

export function useEssenceSourcesI18n(): EssenceSourcesI18n {
  const { t } = useTranslation("essenceSources");
  return {
    seoTitle: t("seo_title"),
    backLabel: t("back_label"),
    topbarEyebrow: t("topbar_eyebrow"),
    topbarMain: t("topbar_main"),
    heroEyebrow: t("hero_eyebrow"),
    heroSubtitle: t("hero_subtitle"),
    heroSourcesWord: t("hero_sources_word"),
    heroWordsWord: t("hero_words_word"),
    kindAll: t("kind_all"),
    kindNotion: t("kind_notion"),
    kindPost: t("kind_post"),
    kindComment: t("kind_comment"),
    kindPoll: t("kind_poll"),
    kindQuiz: t("kind_quiz"),
    searchPlaceholder: t("search_placeholder"),
    sortLastEdited: t("sort_last_edited"),
    sortWordCount: t("sort_word_count"),
    sortTitle: t("sort_title"),
    bulkSelectedSuffix: t("bulk_selected_suffix"),
    bulkRemove: t("bulk_remove"),
    colTitle: t("col_title"),
    colWords: t("col_words"),
    colLastSync: t("col_last_sync"),
    rowSelectLabel: t("row_select_label"),
    rowMoreLabel: t("row_more_label"),
    menuDelete: t("menu_delete"),
    tagNotion: t("tag_notion"),
    tagPost: t("tag_post"),
    tagPoll: t("tag_poll"),
    tagQuiz: t("tag_quiz"),
    tagPostComment: t("tag_post_comment"),
    tagDiscussionComment: t("tag_discussion_comment"),
    paginationPrefix: t("pagination_prefix"),
    paginationOf: t("pagination_of"),
    paginationPrevious: t("pagination_previous"),
    paginationNext: t("pagination_next"),
    emptyTitle: t("empty_title"),
    emptySubtitle: t("empty_subtitle"),
  };
}
