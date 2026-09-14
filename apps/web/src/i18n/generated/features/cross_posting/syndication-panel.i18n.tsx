// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/cross_posting/i18n.rs (`SyndicationPanelTranslate`). Namespace "syndicationPanel".
import { useTranslation } from "react-i18next";

const en = {
  title: "Syndication",
  summary_succeeded: "succeeded",
  summary_failed_suffix: "failed",
  stat_likes: "Likes",
  stat_comments: "Comments",
  stat_reposts: "Reposts",
  status_published: "Published",
  status_pending: "Pending",
  status_failed: "Failed",
  status_skipped: "Skipped",
  queued_hint: "Queued — awaiting dispatch",
  attempts_label: "Attempt",
  btn_view: "View",
  btn_retry: "Retry now",
  engage_likes: "likes",
  engage_comments: "comments",
  engage_reposts: "reposts",
  btn_refresh_aria: "Refresh",
  awaiting_dispatch: "Awaiting dispatch",
  not_connected: "Not connected",
  btn_connect_bluesky: "Connect Bluesky",
  btn_connect_linkedin: "Connect LinkedIn",
  panel_coming_soon: "Coming soon",
  panel_linkedin_coming_soon_hint: "LinkedIn cross-posting arrives in Phase 1B.",
  panel_threads_coming_soon_hint: "Threads cross-posting arrives in Phase 1C.",
};

const ko: Record<keyof typeof en, string> = {
  title: "확장 게시",
  summary_succeeded: "성공",
  summary_failed_suffix: "실패",
  stat_likes: "좋아요",
  stat_comments: "댓글",
  stat_reposts: "재게시",
  status_published: "게시됨",
  status_pending: "대기 중",
  status_failed: "실패",
  status_skipped: "건너뜀",
  queued_hint: "대기열 — 곧 발송됩니다",
  attempts_label: "시도",
  btn_view: "열기",
  btn_retry: "재시도",
  engage_likes: "좋아요",
  engage_comments: "댓글",
  engage_reposts: "재게시",
  btn_refresh_aria: "새로고침",
  awaiting_dispatch: "발송 대기",
  not_connected: "연결 안 됨",
  btn_connect_bluesky: "Bluesky 연결하기",
  btn_connect_linkedin: "LinkedIn 연결하기",
  panel_coming_soon: "곧 출시",
  panel_linkedin_coming_soon_hint: "LinkedIn 크로스포스팅은 Phase 1B 에서 활성화됩니다.",
  panel_threads_coming_soon_hint: "Threads 크로스포스팅은 Phase 1C 에서 활성화됩니다.",
};

export const i18n = { en, ko };

export interface SyndicationPanelI18n {
  title: string;
  summarySucceeded: string;
  summaryFailedSuffix: string;
  statLikes: string;
  statComments: string;
  statReposts: string;
  statusPublished: string;
  statusPending: string;
  statusFailed: string;
  statusSkipped: string;
  queuedHint: string;
  attemptsLabel: string;
  btnView: string;
  btnRetry: string;
  engageLikes: string;
  engageComments: string;
  engageReposts: string;
  btnRefreshAria: string;
  awaitingDispatch: string;
  notConnected: string;
  btnConnectBluesky: string;
  btnConnectLinkedin: string;
  panelComingSoon: string;
  panelLinkedinComingSoonHint: string;
  panelThreadsComingSoonHint: string;
}

export function useSyndicationPanelI18n(): SyndicationPanelI18n {
  const { t } = useTranslation("syndicationPanel");
  return {
    title: t("title"),
    summarySucceeded: t("summary_succeeded"),
    summaryFailedSuffix: t("summary_failed_suffix"),
    statLikes: t("stat_likes"),
    statComments: t("stat_comments"),
    statReposts: t("stat_reposts"),
    statusPublished: t("status_published"),
    statusPending: t("status_pending"),
    statusFailed: t("status_failed"),
    statusSkipped: t("status_skipped"),
    queuedHint: t("queued_hint"),
    attemptsLabel: t("attempts_label"),
    btnView: t("btn_view"),
    btnRetry: t("btn_retry"),
    engageLikes: t("engage_likes"),
    engageComments: t("engage_comments"),
    engageReposts: t("engage_reposts"),
    btnRefreshAria: t("btn_refresh_aria"),
    awaitingDispatch: t("awaiting_dispatch"),
    notConnected: t("not_connected"),
    btnConnectBluesky: t("btn_connect_bluesky"),
    btnConnectLinkedin: t("btn_connect_linkedin"),
    panelComingSoon: t("panel_coming_soon"),
    panelLinkedinComingSoonHint: t("panel_linkedin_coming_soon_hint"),
    panelThreadsComingSoonHint: t("panel_threads_coming_soon_hint"),
  };
}
