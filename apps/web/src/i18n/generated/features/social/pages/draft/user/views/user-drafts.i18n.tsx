// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/social/pages/draft/user/views/i18n.rs (`UserDraftsTranslate`). Namespace "userDrafts".
import { useTranslation } from "react-i18next";

const en = {
  page_title: "Drafts",
  total_label: "total",
  back: "Back",
  new_post: "New Post",
  stat_total: "Total drafts",
  stat_words: "Words written",
  stat_last: "Last edited",
  unit_words: "words",
  time_ago: "ago",
  time_just_now: "just now",
  time_never: "—",
  filter_all: "All",
  filter_today: "Today",
  filter_week: "This Week",
  filter_older: "Older",
  filter_space: "Space-enabled",
  sort_label: "Sort",
  sort_recent: "Recently edited",
  sort_oldest: "Oldest first",
  sort_title: "Title A → Z",
  sort_words: "Most words",
  section_today: "Today",
  section_week: "This Week",
  section_older: "Older",
  untitled: "Untitled draft",
  empty_excerpt: "Tell your story… Use the toolbar to format text, add links, and embed images.",
  badge_space: "Space",
  badge_writing: "Writing now",
  meta_images: "images",
  meta_saved: "Saved",
  resume: "Resume",
  more_options: "More options",
  menu_resume: "Resume editing",
  menu_duplicate: "Duplicate",
  menu_export: "Export as Markdown",
  menu_delete: "Delete draft",
  empty_title: "No drafts yet",
  empty_desc: "Start writing — every post is autosaved as a draft until you publish, so you can pick up exactly where you left off.",
  empty_cta: "Start a draft",
  empty_filtered_title: "No matching drafts",
  empty_filtered_desc: "Try a different filter to see other drafts.",
};

const ko: Record<keyof typeof en, string> = {
  page_title: "초안",
  total_label: "개",
  back: "뒤로",
  new_post: "새 게시물",
  stat_total: "전체 초안",
  stat_words: "작성 단어",
  stat_last: "마지막 편집",
  unit_words: "단어",
  time_ago: "전",
  time_just_now: "방금",
  time_never: "—",
  filter_all: "전체",
  filter_today: "오늘",
  filter_week: "이번 주",
  filter_older: "이전",
  filter_space: "스페이스 사용",
  sort_label: "정렬",
  sort_recent: "최근 편집순",
  sort_oldest: "오래된 순",
  sort_title: "제목순",
  sort_words: "단어 많은순",
  section_today: "오늘",
  section_week: "이번 주",
  section_older: "이전",
  untitled: "제목 없는 초안",
  empty_excerpt: "이야기를 들려주세요…",
  badge_space: "스페이스",
  badge_writing: "작성 중",
  meta_images: "이미지",
  meta_saved: "저장됨",
  resume: "이어쓰기",
  more_options: "더 보기",
  menu_resume: "이어서 편집",
  menu_duplicate: "복제",
  menu_export: "마크다운 내보내기",
  menu_delete: "초안 삭제",
  empty_title: "초안이 없습니다",
  empty_desc: "게시 전까지 모든 글이 초안으로 자동 저장됩니다.",
  empty_cta: "초안 작성",
  empty_filtered_title: "조건에 맞는 초안이 없습니다",
  empty_filtered_desc: "다른 필터를 적용해 보세요.",
};

export const i18n = { en, ko };

export interface UserDraftsI18n {
  pageTitle: string;
  totalLabel: string;
  back: string;
  newPost: string;
  statTotal: string;
  statWords: string;
  statLast: string;
  unitWords: string;
  timeAgo: string;
  timeJustNow: string;
  timeNever: string;
  filterAll: string;
  filterToday: string;
  filterWeek: string;
  filterOlder: string;
  filterSpace: string;
  sortLabel: string;
  sortRecent: string;
  sortOldest: string;
  sortTitle: string;
  sortWords: string;
  sectionToday: string;
  sectionWeek: string;
  sectionOlder: string;
  untitled: string;
  emptyExcerpt: string;
  badgeSpace: string;
  badgeWriting: string;
  metaImages: string;
  metaSaved: string;
  resume: string;
  moreOptions: string;
  menuResume: string;
  menuDuplicate: string;
  menuExport: string;
  menuDelete: string;
  emptyTitle: string;
  emptyDesc: string;
  emptyCta: string;
  emptyFilteredTitle: string;
  emptyFilteredDesc: string;
}

export function useUserDraftsI18n(): UserDraftsI18n {
  const { t } = useTranslation("userDrafts");
  return {
    pageTitle: t("page_title"),
    totalLabel: t("total_label"),
    back: t("back"),
    newPost: t("new_post"),
    statTotal: t("stat_total"),
    statWords: t("stat_words"),
    statLast: t("stat_last"),
    unitWords: t("unit_words"),
    timeAgo: t("time_ago"),
    timeJustNow: t("time_just_now"),
    timeNever: t("time_never"),
    filterAll: t("filter_all"),
    filterToday: t("filter_today"),
    filterWeek: t("filter_week"),
    filterOlder: t("filter_older"),
    filterSpace: t("filter_space"),
    sortLabel: t("sort_label"),
    sortRecent: t("sort_recent"),
    sortOldest: t("sort_oldest"),
    sortTitle: t("sort_title"),
    sortWords: t("sort_words"),
    sectionToday: t("section_today"),
    sectionWeek: t("section_week"),
    sectionOlder: t("section_older"),
    untitled: t("untitled"),
    emptyExcerpt: t("empty_excerpt"),
    badgeSpace: t("badge_space"),
    badgeWriting: t("badge_writing"),
    metaImages: t("meta_images"),
    metaSaved: t("meta_saved"),
    resume: t("resume"),
    moreOptions: t("more_options"),
    menuResume: t("menu_resume"),
    menuDuplicate: t("menu_duplicate"),
    menuExport: t("menu_export"),
    menuDelete: t("menu_delete"),
    emptyTitle: t("empty_title"),
    emptyDesc: t("empty_desc"),
    emptyCta: t("empty_cta"),
    emptyFilteredTitle: t("empty_filtered_title"),
    emptyFilteredDesc: t("empty_filtered_desc"),
  };
}
