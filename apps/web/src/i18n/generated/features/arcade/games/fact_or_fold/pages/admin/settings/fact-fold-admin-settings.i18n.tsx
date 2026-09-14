// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/arcade/games/fact_or_fold/pages/admin/settings/i18n.rs (`FactFoldAdminSettingsTranslate`). Namespace "factFoldAdminSettings".
import { useTranslation } from "react-i18next";

const en = {
  page_title: "Settings",
  loading: "Loading settings…",
  save: "Save",
  saving: "Saving…",
  saved: "Saved.",
  section_round_title: "01 · Round",
  section_round_sub: "Capacity + per-stage timing",
  round_capacity: "Round capacity",
  round_capacity_desc: "Players per round (v1 fixed at 4 in spec; this knob is for ops experiments).",
  round_capacity_solo_warning: "Solo mode (capacity 1) bypasses the insider dynamic — use for dev / smoke tests only.",
  stage_news_reveal_sec: "Stage 1 — News reveal (sec)",
  stage_bet_sec: "Stage 2 — First bet (sec)",
  stage_rationale_sec: "Stage 3 — Rationale (sec)",
  stage_reveal_sec: "Stage 4 — Reveal (sec)",
  stage_debate_sec: "Stage 5 — Debate (sec)",
  stage_sec_desc: "Seconds before auto-advance.",
  section_economy_title: "02 · Economy",
  section_economy_sub: "RatelPoint stakes + bonuses",
  min_bet_rp: "Min bet",
  min_bet_rp_desc: "Lowest RP a player may stake per round.",
  max_bet_rp: "Max bet",
  max_bet_rp_desc: "Stake cap per round.",
  correct_multiplier: "Correct-side multiplier",
  correct_multiplier_desc: "Stored as basis points (10000 = 1.0×); UI shows the human ×.",
  insider_bonus: "Insider correct bonus",
  insider_bonus_desc: "Extra ×stake when the insider bets the truth and wins.",
  influence_bonus: "Influence (flip-cite) bonus",
  influence_bonus_desc: "Share of the cited player's stake the citer takes when the flip wins.",
  signup_rp: "Signup bonus RP",
  signup_rp_desc: "One-time grant on account creation.",
  section_insider_title: "03 · Insider",
  section_insider_sub: "v1: TRUTH-KNOWER 1명 fixed",
  insider_note: "v1 ships a single truth-knowing insider per round (D1/D2). Mafia mode (false-statement insider) deferred to v2 — no admin knob until then.",
  section_ops_title: "04 · Operations",
  section_ops_sub: "Reconnect + queue health",
  reconnect_grace: "Reconnect grace (sec)",
  reconnect_grace_desc: "Drop window before a disconnected player auto-forfeits and gets refunded.",
  queue_alert: "Queue alert threshold (days)",
  queue_alert_desc: "When the latest scheduled subject is closer than this, the admin sees a low-queue banner (FR-45).",
  deferred_title: "Deferred (mockup mentions, not yet wired):",
  deferred_auto_publish: "Auto-publish KST hour-of-day — needs a scheduler decision.",
  deferred_auto_backfill: "Auto-backfill from insider pool when queue is empty — out of v1 scope.",
  deferred_essence_policy: "Essence opt-in policies (default opt-in, min length, false-side handling) land with PR6.",
  deferred_danger_zone: "Danger zone (force-end round, export, grant admin) — separate ops surface, not this form.",
  unit_people: "people",
  unit_sec: "sec",
  unit_rp: "RP",
  unit_day: "days",
};

const ko: Record<keyof typeof en, string> = {
  page_title: "설정",
  loading: "설정 불러오는 중…",
  save: "저장",
  saving: "저장 중…",
  saved: "저장됨.",
  section_round_title: "01 · 라운드",
  section_round_sub: "정원 + 단계별 시간",
  round_capacity: "라운드 정원",
  round_capacity_desc: "라운드당 인원 (v1 스펙 고정 4명; 운영 실험용 노브).",
  round_capacity_solo_warning: "솔로 모드 (정원 1)는 인사이더 게임을 우회해요 — 개발/스모크 테스트 용도로만 사용하세요.",
  stage_news_reveal_sec: "단계 1 — 뉴스 공개 (초)",
  stage_bet_sec: "단계 2 — 1차 베팅 (초)",
  stage_rationale_sec: "단계 3 — 근거 작성 (초)",
  stage_reveal_sec: "단계 4 — 근거 공개 (초)",
  stage_debate_sec: "단계 5 — 토론 (초)",
  stage_sec_desc: "자동 진행까지의 초.",
  section_economy_title: "02 · 경제",
  section_economy_sub: "RP 베팅 + 보너스",
  min_bet_rp: "최소 베팅",
  min_bet_rp_desc: "한 라운드 최저 베팅 RP.",
  max_bet_rp: "최대 베팅",
  max_bet_rp_desc: "한 라운드 베팅 상한.",
  correct_multiplier: "정답 보너스 배율",
  correct_multiplier_desc: "bps로 저장됨 (10000 = 1.0×); UI는 ×로 표시.",
  insider_bonus: "인사이더 정답 보너스",
  insider_bonus_desc: "인사이더가 정답 진영으로 이겼을 때 추가 ×stake.",
  influence_bonus: "인용 영향력 보너스",
  influence_bonus_desc: "인용한 사람이 flip해서 이겼을 때 인용된 사람이 가져오는 stake 비율.",
  signup_rp: "가입 보너스 RP",
  signup_rp_desc: "계정 생성 시 1회 지급.",
  section_insider_title: "03 · 인사이더",
  section_insider_sub: "v1: TRUTH-KNOWER 1명 고정",
  insider_note: "v1은 라운드당 진실 인사이더 1명 고정(D1/D2). 거짓 인사이더(mafia mode)는 v2 도입 — 그때까지 관리자 노브 없음.",
  section_ops_title: "04 · 운영",
  section_ops_sub: "재접속 + 큐 상태",
  reconnect_grace: "재접속 유예 (초)",
  reconnect_grace_desc: "연결 끊긴 참가자가 자동 기권 + 환불되기까지의 유예 시간.",
  queue_alert: "큐 알림 임계 (일)",
  queue_alert_desc: "최신 스케줄 대상이 이 일수보다 가까우면 관리자에게 큐 부족 배너 표시(FR-45).",
  deferred_title: "보류 (mockup만 있고 아직 미반영):",
  deferred_auto_publish: "KST 자동 발행 시각 — 스케줄러 결정 필요.",
  deferred_auto_backfill: "큐가 비면 인사이더 풀에서 자동 백필 — v1 스코프 외.",
  deferred_essence_policy: "Essence opt-in 정책 (기본 opt-in, 최소 길이, 거짓 진영 처리)은 PR6에서.",
  deferred_danger_zone: "위험 영역 (강제 종료, 내보내기, 관리자 부여) — 이 폼이 아닌 별도 운영 화면에서.",
  unit_people: "명",
  unit_sec: "초",
  unit_rp: "RP",
  unit_day: "일",
};

export const i18n = { en, ko };

export interface FactFoldAdminSettingsI18n {
  pageTitle: string;
  loading: string;
  save: string;
  saving: string;
  saved: string;
  sectionRoundTitle: string;
  sectionRoundSub: string;
  roundCapacity: string;
  roundCapacityDesc: string;
  roundCapacitySoloWarning: string;
  stageNewsRevealSec: string;
  stageBetSec: string;
  stageRationaleSec: string;
  stageRevealSec: string;
  stageDebateSec: string;
  stageSecDesc: string;
  sectionEconomyTitle: string;
  sectionEconomySub: string;
  minBetRp: string;
  minBetRpDesc: string;
  maxBetRp: string;
  maxBetRpDesc: string;
  correctMultiplier: string;
  correctMultiplierDesc: string;
  insiderBonus: string;
  insiderBonusDesc: string;
  influenceBonus: string;
  influenceBonusDesc: string;
  signupRp: string;
  signupRpDesc: string;
  sectionInsiderTitle: string;
  sectionInsiderSub: string;
  insiderNote: string;
  sectionOpsTitle: string;
  sectionOpsSub: string;
  reconnectGrace: string;
  reconnectGraceDesc: string;
  queueAlert: string;
  queueAlertDesc: string;
  deferredTitle: string;
  deferredAutoPublish: string;
  deferredAutoBackfill: string;
  deferredEssencePolicy: string;
  deferredDangerZone: string;
  unitPeople: string;
  unitSec: string;
  unitRp: string;
  unitDay: string;
}

export function useFactFoldAdminSettingsI18n(): FactFoldAdminSettingsI18n {
  const { t } = useTranslation("factFoldAdminSettings");
  return {
    pageTitle: t("page_title"),
    loading: t("loading"),
    save: t("save"),
    saving: t("saving"),
    saved: t("saved"),
    sectionRoundTitle: t("section_round_title"),
    sectionRoundSub: t("section_round_sub"),
    roundCapacity: t("round_capacity"),
    roundCapacityDesc: t("round_capacity_desc"),
    roundCapacitySoloWarning: t("round_capacity_solo_warning"),
    stageNewsRevealSec: t("stage_news_reveal_sec"),
    stageBetSec: t("stage_bet_sec"),
    stageRationaleSec: t("stage_rationale_sec"),
    stageRevealSec: t("stage_reveal_sec"),
    stageDebateSec: t("stage_debate_sec"),
    stageSecDesc: t("stage_sec_desc"),
    sectionEconomyTitle: t("section_economy_title"),
    sectionEconomySub: t("section_economy_sub"),
    minBetRp: t("min_bet_rp"),
    minBetRpDesc: t("min_bet_rp_desc"),
    maxBetRp: t("max_bet_rp"),
    maxBetRpDesc: t("max_bet_rp_desc"),
    correctMultiplier: t("correct_multiplier"),
    correctMultiplierDesc: t("correct_multiplier_desc"),
    insiderBonus: t("insider_bonus"),
    insiderBonusDesc: t("insider_bonus_desc"),
    influenceBonus: t("influence_bonus"),
    influenceBonusDesc: t("influence_bonus_desc"),
    signupRp: t("signup_rp"),
    signupRpDesc: t("signup_rp_desc"),
    sectionInsiderTitle: t("section_insider_title"),
    sectionInsiderSub: t("section_insider_sub"),
    insiderNote: t("insider_note"),
    sectionOpsTitle: t("section_ops_title"),
    sectionOpsSub: t("section_ops_sub"),
    reconnectGrace: t("reconnect_grace"),
    reconnectGraceDesc: t("reconnect_grace_desc"),
    queueAlert: t("queue_alert"),
    queueAlertDesc: t("queue_alert_desc"),
    deferredTitle: t("deferred_title"),
    deferredAutoPublish: t("deferred_auto_publish"),
    deferredAutoBackfill: t("deferred_auto_backfill"),
    deferredEssencePolicy: t("deferred_essence_policy"),
    deferredDangerZone: t("deferred_danger_zone"),
    unitPeople: t("unit_people"),
    unitSec: t("unit_sec"),
    unitRp: t("unit_rp"),
    unitDay: t("unit_day"),
  };
}
