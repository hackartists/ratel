import { useTranslation } from "react-i18next";

// String literals of the admin area that the Dioxus app rendered OUTSIDE its
// `translate!` blocks (so the one-off i18n extraction produced nothing for them):
// admin/layout.rs, admin/views/main/mod.rs, admin/models/reward_types.rs,
// common/hooks/use_infinite_query.rs and the fact_or_fold admin pages. The
// Rust app shows them verbatim in every language, so both tables hold the
// same text; move a key into a real translation once the product wants one.
const en = {
  // admin/layout.rs
  back: "Back",
  brand_logo: "R",

  // views/main — AnalyzeQuotaSection
  quota_title: "분석 페이지 생성 한도",
  quota_meta_saved: "DB 저장됨",
  quota_meta_default: "기본값 사용 중",
  quota_label: "스페이스당 한도 (Non-Enterprise)",
  quota_save: "저장",
  quota_saving: "저장 중…",
  quota_hint: "Enterprise 등급은 무제한 — 이 값과 무관",
  quota_negative: "0 이상의 값을 입력하세요",
  quota_saved: "저장되었습니다",
  quota_save_failed: "저장 실패: {{err}}",

  // views/main — TestAccountsSection
  test_title: "테스트 계정 (스토어 심사용)",
  test_count: "{{count}}개",
  test_email_placeholder: "reviewer@example.com",
  test_note_placeholder: "메모 (예: App Store 심사)",
  test_add: "추가",
  test_adding: "추가 중…",
  test_hint: "등록된 이메일은 인증 메일 없이 코드 000000 으로 로그인됩니다.",
  test_invalid_email: "유효한 이메일을 입력하세요",
  test_added: "추가되었습니다",
  test_add_failed: "추가 실패: {{err}}",
  test_col_email: "이메일",
  test_col_note: "메모",
  test_col_manage: "관리",
  test_empty: "등록된 테스트 계정이 없습니다.",
  test_delete: "삭제",

  // views/main — reward form condition options
  condition_none: "None",
  condition_max_claims: "Max Claims",
  condition_max_points: "Max Points",
  condition_max_user_claims: "Max User Claims",
  condition_max_user_points: "Max User Points",
  // models/reward_types.rs — RewardConditionExt::label
  condition_max_claims_value: "Max Claims: {{value}}",
  condition_max_points_value: "Max Points: {{value}}",
  condition_max_user_claims_value: "Max User Claims: {{value}}",
  condition_max_user_points_value: "Max User Points: {{value}}",
  // models/reward_types.rs — RewardUserBehaviorExt::label
  behavior_respond_poll: "Poll Response",
  behavior_discussion_comment: "Discussion Comment",
  behavior_quiz_answer: "Quiz Answer",
  behavior_follow: "Follow",
  behavior_attend_meet: "Attend Meet",
  // models/reward_types.rs — RewardPeriodExt::label
  period_once: "Once",
  period_hourly: "Hourly",
  period_daily: "Daily",
  period_weekly: "Weekly",
  period_monthly: "Monthly",
  period_yearly: "Yearly",
  period_unlimited: "Unlimited",

  // views/main — moderation queue
  moderation_title: "신고 관리",
  moderation_description:
    "신고 누적으로 검토 대기 중인 사용자입니다. 차단 시 소프트밴(기존 댓글 숨김 + 새 댓글 작성 금지), 기각 시 숨긴 댓글이 복원됩니다.",
  moderation_col_user: "사용자",
  moderation_col_reports: "신고 수",
  moderation_col_action: "조치",
  moderation_empty: "검토 대기 중인 신고가 없습니다.",
  moderation_block: "차단",
  moderation_dismiss: "기각",

  // common/hooks/use_infinite_query.rs — InfiniteQuery::more_element
  loading_more: "Loading more...",

  // fact_or_fold admin pages
  ff_page_title: "{{page}} · Fact or Fold",
  ff_settings_page_title: "Settings · Fact or Fold",
  ff_verdict_real: "REAL",
  ff_verdict_fake: "FAKE",
  ff_status_draft: "DRAFT",
  ff_status_scheduled: "SCHEDULED",
  ff_status_live: "LIVE",
  ff_status_settled: "SETTLED",
  ff_status_deleted: "DELETED",
  ff_schedule_required: "Pick a future schedule time first.",
  ff_source_url_placeholder: "https://…",
};

const ko: Record<keyof typeof en, string> = { ...en };

export const i18n = { en, ko };

type Key = keyof typeof en;

export interface AdminLiteralsI18n {
  text: (key: Key) => string;
  fill: (key: Key, values: Record<string, string | number>) => string;
}

function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (whole, name: string) => (name in values ? String(values[name]) : whole));
}

export function useAdminLiteralsI18n(): AdminLiteralsI18n {
  // Subscribes to language changes like every generated hook.
  const { i18n: instance } = useTranslation("adminLayout");
  const table = instance.resolvedLanguage === "ko" ? ko : en;
  return {
    text: (key) => table[key],
    fill: (key, values) => interpolate(table[key], values),
  };
}
