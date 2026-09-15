// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/posts/views/post_detail/i18n.rs (`PostDetailSyndicatedTranslate`). Namespace "postDetailSyndicated".
import { useTranslation } from "react-i18next";

const en = {
  topbar_eyebrow: "Post",
  topbar_main: "Detail",
  btn_edit: "Edit",
  btn_share: "Share",
  btn_back_aria: "Back",
  action_likes_suffix: "likes",
  action_comments_suffix: "comments",
  share_link_copied: "Link copied to clipboard",
  share_link_copy_failed: "Failed to copy link",
  drawer_comments_title: "Comments",
  drawer_close: "Close",
  comment_placeholder: "Add a comment…",
  post_btn: "Post",
  reply_label: "Reply",
  reply_placeholder: "Reply…",
  replies_label: "replies",
  syn_title: "Syndication",
  syn_summary_prefix: "succeeded",
  stat_external_reads: "External reads",
  stat_reactions: "Reactions",
  stat_backlink_clicks: "Backlink clicks",
  status_coming_soon: "Coming soon",
  card_coming_soon_hint: "Integration will launch soon",
  refer_close_aria: "Close",
  refer_text_bluesky: "You arrived from Bluesky — see the full thinking and subscribe to the author on Ratel.",
  refer_text_linkedin: "You arrived from LinkedIn — see the full thinking and subscribe to the author on Ratel.",
  refer_text_threads: "You arrived from Threads — see the full thinking and subscribe to the author on Ratel.",
  refer_text_generic: "You're reading this on Ratel — every post is a queryable surface, not just a feed item.",
  brand_signin: "Sign in",
  brand_get_started: "Get started",
  subscribe_cta_eyebrow: "Want more from this author?",
  subscribe_cta_title: "Create a free Ratel account to follow them.",
  subscribe_cta_sub: "Reading is always free. Connect your social accounts to bring your own audience along.",
  subscribe_cta_primary: "Create free account",
  subscribe_cta_secondary: "I have an account",
  published_just_now: "Published just now",
  published_minutes_ago: "Published {{n}}m ago",
  published_hours_ago: "Published {{n}}h ago",
  published_days_ago: "Published {{n}}d ago",
  min_read: "{{n}} min read",
  house_card_eyebrow: "Essence House",
  house_card_hero_title_suffix: "'s House",
  house_card_hero_sub: "Author on Ratel",
  house_card_pitch: "Subscribe to follow this author and get every new Ratel post — queryable from ChatGPT, Claude Desktop, or any MCP client.",
  house_card_cta: "Subscribe to House",
  house_card_note: "One unified MCP endpoint across every House you subscribe to. Cancel anytime.",
  mcp_card_title: "MCP-ready",
  mcp_card_body_lead: "Register",
  mcp_card_body_endpoint: "mcp.ratel.foundation",
  mcp_card_body_tail: "in ChatGPT or Claude Desktop. One endpoint, every subscribed House — query across minds like a single corpus.",
};

const ko: Record<keyof typeof en, string> = {
  topbar_eyebrow: "포스트",
  topbar_main: "상세",
  btn_edit: "편집",
  btn_share: "공유",
  btn_back_aria: "뒤로",
  action_likes_suffix: "좋아요",
  action_comments_suffix: "댓글",
  share_link_copied: "링크가 복사되었습니다",
  share_link_copy_failed: "링크 복사에 실패했습니다",
  drawer_comments_title: "댓글",
  drawer_close: "닫기",
  comment_placeholder: "댓글을 남기세요…",
  post_btn: "등록",
  reply_label: "답글",
  reply_placeholder: "답글 남기기…",
  replies_label: "답글",
  syn_title: "크로스 포스팅",
  syn_summary_prefix: "성공",
  stat_external_reads: "외부 열람수",
  stat_reactions: "반응",
  stat_backlink_clicks: "백링크 클릭",
  status_coming_soon: "준비 중",
  card_coming_soon_hint: "연동 준비 중입니다",
  refer_close_aria: "닫기",
  refer_text_bluesky: "Bluesky 에서 오셨군요. Ratel 에서 글 전체를 읽고 작성자를 구독해 보세요.",
  refer_text_linkedin: "LinkedIn 에서 오셨군요. Ratel 에서 글 전체를 읽고 작성자를 구독해 보세요.",
  refer_text_threads: "Threads 에서 오셨군요. Ratel 에서 글 전체를 읽고 작성자를 구독해 보세요.",
  refer_text_generic: "이 글은 Ratel 에서 읽고 계십니다. 모든 글은 단순 피드가 아닌 쿼리 가능한 자산입니다.",
  brand_signin: "로그인",
  brand_get_started: "시작하기",
  subscribe_cta_eyebrow: "이 작성자의 글이 더 궁금하신가요?",
  subscribe_cta_title: "Ratel 계정을 무료로 만들어 팔로우해 보세요.",
  subscribe_cta_sub: "읽기는 항상 무료입니다. 소셜 계정을 연결해 자신의 독자도 함께 데려와 보세요.",
  subscribe_cta_primary: "무료 계정 만들기",
  subscribe_cta_secondary: "이미 계정이 있어요",
  published_just_now: "방금 발행됨",
  published_minutes_ago: "{{n}}분 전 발행",
  published_hours_ago: "{{n}}시간 전 발행",
  published_days_ago: "{{n}}일 전 발행",
  min_read: "{{n}}분 읽기",
  house_card_eyebrow: "에센스 하우스",
  house_card_hero_title_suffix: "님의 하우스",
  house_card_hero_sub: "Ratel 작성자",
  house_card_pitch: "이 작성자를 구독하면 Ratel 새 글을 모두 받아볼 수 있고, ChatGPT / Claude Desktop / MCP 클라이언트에서도 쿼리 가능합니다.",
  house_card_cta: "하우스 구독",
  house_card_note: "구독한 모든 하우스에 단일 MCP 엔드포인트로 접근. 언제든 취소 가능.",
  mcp_card_title: "MCP 지원",
  mcp_card_body_lead: "ChatGPT 또는 Claude Desktop 에",
  mcp_card_body_endpoint: "mcp.ratel.foundation",
  mcp_card_body_tail: "을 등록하세요. 구독한 모든 하우스를 단일 코퍼스처럼 한 엔드포인트에서 쿼리할 수 있습니다.",
};

export const i18n = { en, ko };

export interface PostDetailSyndicatedI18n {
  topbarEyebrow: string;
  topbarMain: string;
  btnEdit: string;
  btnShare: string;
  btnBackAria: string;
  actionLikesSuffix: string;
  actionCommentsSuffix: string;
  shareLinkCopied: string;
  shareLinkCopyFailed: string;
  drawerCommentsTitle: string;
  drawerClose: string;
  commentPlaceholder: string;
  postBtn: string;
  replyLabel: string;
  replyPlaceholder: string;
  repliesLabel: string;
  synTitle: string;
  synSummaryPrefix: string;
  statExternalReads: string;
  statReactions: string;
  statBacklinkClicks: string;
  statusComingSoon: string;
  cardComingSoonHint: string;
  referCloseAria: string;
  referTextBluesky: string;
  referTextLinkedin: string;
  referTextThreads: string;
  referTextGeneric: string;
  brandSignin: string;
  brandGetStarted: string;
  subscribeCtaEyebrow: string;
  subscribeCtaTitle: string;
  subscribeCtaSub: string;
  subscribeCtaPrimary: string;
  subscribeCtaSecondary: string;
  publishedJustNow: string;
  publishedMinutesAgo: (values: { n: string | number }) => string;
  publishedHoursAgo: (values: { n: string | number }) => string;
  publishedDaysAgo: (values: { n: string | number }) => string;
  minRead: (values: { n: string | number }) => string;
  houseCardEyebrow: string;
  houseCardHeroTitleSuffix: string;
  houseCardHeroSub: string;
  houseCardPitch: string;
  houseCardCta: string;
  houseCardNote: string;
  mcpCardTitle: string;
  mcpCardBodyLead: string;
  mcpCardBodyEndpoint: string;
  mcpCardBodyTail: string;
}

export function usePostDetailSyndicatedI18n(): PostDetailSyndicatedI18n {
  const { t } = useTranslation("postDetailSyndicated");
  return {
    topbarEyebrow: t("topbar_eyebrow"),
    topbarMain: t("topbar_main"),
    btnEdit: t("btn_edit"),
    btnShare: t("btn_share"),
    btnBackAria: t("btn_back_aria"),
    actionLikesSuffix: t("action_likes_suffix"),
    actionCommentsSuffix: t("action_comments_suffix"),
    shareLinkCopied: t("share_link_copied"),
    shareLinkCopyFailed: t("share_link_copy_failed"),
    drawerCommentsTitle: t("drawer_comments_title"),
    drawerClose: t("drawer_close"),
    commentPlaceholder: t("comment_placeholder"),
    postBtn: t("post_btn"),
    replyLabel: t("reply_label"),
    replyPlaceholder: t("reply_placeholder"),
    repliesLabel: t("replies_label"),
    synTitle: t("syn_title"),
    synSummaryPrefix: t("syn_summary_prefix"),
    statExternalReads: t("stat_external_reads"),
    statReactions: t("stat_reactions"),
    statBacklinkClicks: t("stat_backlink_clicks"),
    statusComingSoon: t("status_coming_soon"),
    cardComingSoonHint: t("card_coming_soon_hint"),
    referCloseAria: t("refer_close_aria"),
    referTextBluesky: t("refer_text_bluesky"),
    referTextLinkedin: t("refer_text_linkedin"),
    referTextThreads: t("refer_text_threads"),
    referTextGeneric: t("refer_text_generic"),
    brandSignin: t("brand_signin"),
    brandGetStarted: t("brand_get_started"),
    subscribeCtaEyebrow: t("subscribe_cta_eyebrow"),
    subscribeCtaTitle: t("subscribe_cta_title"),
    subscribeCtaSub: t("subscribe_cta_sub"),
    subscribeCtaPrimary: t("subscribe_cta_primary"),
    subscribeCtaSecondary: t("subscribe_cta_secondary"),
    publishedJustNow: t("published_just_now"),
    publishedMinutesAgo: (values) => t("published_minutes_ago", { replace: values }),
    publishedHoursAgo: (values) => t("published_hours_ago", { replace: values }),
    publishedDaysAgo: (values) => t("published_days_ago", { replace: values }),
    minRead: (values) => t("min_read", { replace: values }),
    houseCardEyebrow: t("house_card_eyebrow"),
    houseCardHeroTitleSuffix: t("house_card_hero_title_suffix"),
    houseCardHeroSub: t("house_card_hero_sub"),
    houseCardPitch: t("house_card_pitch"),
    houseCardCta: t("house_card_cta"),
    houseCardNote: t("house_card_note"),
    mcpCardTitle: t("mcp_card_title"),
    mcpCardBodyLead: t("mcp_card_body_lead"),
    mcpCardBodyEndpoint: t("mcp_card_body_endpoint"),
    mcpCardBodyTail: t("mcp_card_body_tail"),
  };
}
