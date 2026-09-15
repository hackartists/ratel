// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/posts/views/post_edit/i18n.rs (`PostEditTranslate`). Namespace "postEdit".
import { useTranslation } from "react-i18next";

const en = {
  page_eyebrow: "Composer",
  page_title: "New Post",
  autosaved: "Autosaved",
  saving: "Saving…",
  all_changes_saved: "All changes saved",
  unsaved_changes: "Unsaved changes",
  publishing: "Publishing…",
  just_now: "just now",
  save_draft: "Save Draft",
  publish: "Publish",
  design_space: "Design Space",
  back: "Back",
  type_post: "Post",
  type_repost: "Repost",
  type_artwork: "Artwork",
  coming_soon: "Soon",
  title_placeholder: "Title your post…",
  body_placeholder: "Tell your story… Use the toolbar to format text, add links, and embed images.",
  add_attachment: "Add",
  posting_as: "Posting as",
  personal_feed: "Personal feed",
  group_personal: "Personal",
  group_teams: "Teams",
  team_meta: "Team",
  enable_space: "Enable Space",
  space_hint: "Turn this post into a Space — a dedicated arena where members can vote, discuss, and earn rewards together.",
  space_active_hint: "Publish will take you to the Space designer to configure quests, rewards, and members.",
  tags: "Tags",
  tag_placeholder: "Add a tag…",
  remove_tag: "Remove tag",
  visibility: "Visibility",
  visibility_public: "Public",
  visibility_private: "Private",
  visibility_syndicated_remain_title: "Syndicated copies stay visible",
  visibility_syndicated_remain_body: "Switching to Private hides this post on Ratel, but copies already cross-posted to external networks remain visible. Delete them on each platform if you need them removed.",
  discard_confirm_title: "Discard this draft?",
  discard_confirm_body: "Discarding will permanently remove the current draft. This action cannot be undone.",
  cancel: "Cancel",
  discard_draft: "Discard Draft",
  options: "Options",
  close_options: "Close options",
  post_options: "Post Options",
  stat_words: "words",
  stat_chars: "chars",
  stat_read: "read",
  stat_min: "min",
  stat_images: "images",
  stat_saved: "Saved",
  stat_ago: "ago",
  stat_not_saved: "Not saved",
  spell_check: "Spell-check",
};

const ko: Record<keyof typeof en, string> = {
  page_eyebrow: "작성기",
  page_title: "새 게시물",
  autosaved: "자동 저장됨",
  saving: "저장 중…",
  all_changes_saved: "모든 변경사항 저장됨",
  unsaved_changes: "저장되지 않은 변경사항",
  publishing: "게시 중…",
  just_now: "방금",
  save_draft: "초안 저장",
  publish: "게시",
  design_space: "스페이스 설계",
  back: "뒤로",
  type_post: "게시글",
  type_repost: "공유",
  type_artwork: "작품",
  coming_soon: "준비중",
  title_placeholder: "게시물 제목을 입력하세요…",
  body_placeholder: "이야기를 들려주세요… 도구 모음을 사용해 서식, 링크, 이미지를 추가할 수 있어요.",
  add_attachment: "추가",
  posting_as: "게시자",
  personal_feed: "개인 피드",
  group_personal: "개인",
  group_teams: "팀",
  team_meta: "팀",
  enable_space: "스페이스 활성화",
  space_hint: "이 게시물을 스페이스로 전환하세요. 투표하고, 토론하고, 보상을 함께 받을 수 있는 전용 공간을 제공합니다.",
  space_active_hint: "게시하면 퀘스트, 보상, 멤버를 설정하는 스페이스 디자이너로 이동합니다.",
  tags: "태그",
  tag_placeholder: "태그 추가…",
  remove_tag: "태그 제거",
  visibility: "공개 범위",
  visibility_public: "공개",
  visibility_private: "비공개",
  visibility_syndicated_remain_title: "이미 발행된 사본은 그대로 남습니다",
  visibility_syndicated_remain_body: "비공개로 전환하면 Ratel에서는 글이 숨겨지지만, 외부 네트워크에 이미 발행된 크로스포스트 사본은 그대로 표시됩니다. 필요하다면 각 플랫폼에서 직접 삭제해주세요.",
  discard_confirm_title: "초안을 폐기할까요?",
  discard_confirm_body: "초안을 폐기하면 현재 작성 중인 내용이 영구 삭제됩니다. 되돌릴 수 없습니다.",
  cancel: "취소",
  discard_draft: "초안 버리기",
  options: "옵션",
  close_options: "옵션 닫기",
  post_options: "게시 옵션",
  stat_words: "단어",
  stat_chars: "자",
  stat_read: "읽기",
  stat_min: "분",
  stat_images: "이미지",
  stat_saved: "저장됨",
  stat_ago: "전",
  stat_not_saved: "저장되지 않음",
  spell_check: "맞춤법",
};

export const i18n = { en, ko };

export interface PostEditI18n {
  pageEyebrow: string;
  pageTitle: string;
  autosaved: string;
  saving: string;
  allChangesSaved: string;
  unsavedChanges: string;
  publishing: string;
  justNow: string;
  saveDraft: string;
  publish: string;
  designSpace: string;
  back: string;
  typePost: string;
  typeRepost: string;
  typeArtwork: string;
  comingSoon: string;
  titlePlaceholder: string;
  bodyPlaceholder: string;
  addAttachment: string;
  postingAs: string;
  personalFeed: string;
  groupPersonal: string;
  groupTeams: string;
  teamMeta: string;
  enableSpace: string;
  spaceHint: string;
  spaceActiveHint: string;
  tags: string;
  tagPlaceholder: string;
  removeTag: string;
  visibility: string;
  visibilityPublic: string;
  visibilityPrivate: string;
  visibilitySyndicatedRemainTitle: string;
  visibilitySyndicatedRemainBody: string;
  discardConfirmTitle: string;
  discardConfirmBody: string;
  cancel: string;
  discardDraft: string;
  options: string;
  closeOptions: string;
  postOptions: string;
  statWords: string;
  statChars: string;
  statRead: string;
  statMin: string;
  statImages: string;
  statSaved: string;
  statAgo: string;
  statNotSaved: string;
  spellCheck: string;
}

export function usePostEditI18n(): PostEditI18n {
  const { t } = useTranslation("postEdit");
  return {
    pageEyebrow: t("page_eyebrow"),
    pageTitle: t("page_title"),
    autosaved: t("autosaved"),
    saving: t("saving"),
    allChangesSaved: t("all_changes_saved"),
    unsavedChanges: t("unsaved_changes"),
    publishing: t("publishing"),
    justNow: t("just_now"),
    saveDraft: t("save_draft"),
    publish: t("publish"),
    designSpace: t("design_space"),
    back: t("back"),
    typePost: t("type_post"),
    typeRepost: t("type_repost"),
    typeArtwork: t("type_artwork"),
    comingSoon: t("coming_soon"),
    titlePlaceholder: t("title_placeholder"),
    bodyPlaceholder: t("body_placeholder"),
    addAttachment: t("add_attachment"),
    postingAs: t("posting_as"),
    personalFeed: t("personal_feed"),
    groupPersonal: t("group_personal"),
    groupTeams: t("group_teams"),
    teamMeta: t("team_meta"),
    enableSpace: t("enable_space"),
    spaceHint: t("space_hint"),
    spaceActiveHint: t("space_active_hint"),
    tags: t("tags"),
    tagPlaceholder: t("tag_placeholder"),
    removeTag: t("remove_tag"),
    visibility: t("visibility"),
    visibilityPublic: t("visibility_public"),
    visibilityPrivate: t("visibility_private"),
    visibilitySyndicatedRemainTitle: t("visibility_syndicated_remain_title"),
    visibilitySyndicatedRemainBody: t("visibility_syndicated_remain_body"),
    discardConfirmTitle: t("discard_confirm_title"),
    discardConfirmBody: t("discard_confirm_body"),
    cancel: t("cancel"),
    discardDraft: t("discard_draft"),
    options: t("options"),
    closeOptions: t("close_options"),
    postOptions: t("post_options"),
    statWords: t("stat_words"),
    statChars: t("stat_chars"),
    statRead: t("stat_read"),
    statMin: t("stat_min"),
    statImages: t("stat_images"),
    statSaved: t("stat_saved"),
    statAgo: t("stat_ago"),
    statNotSaved: t("stat_not_saved"),
    spellCheck: t("spell_check"),
  };
}
