// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/arcade/i18n.rs (`ArcadeHomeTranslate`). Namespace "arcadeHome".
import { useTranslation } from "react-i18next";

const en = {
  tag_live: "LIVE · Round in progress",
  tag_waiting: "WAITING · Lobby filling",
  tag_open: "OPEN · Subject ready",
  tag_closed: "CLOSED · No subjects queued",
  tag_settled: "SETTLED · Round complete",
  featured_title: "Fact or Fold",
  featured_tagline: "Four players, one news headline. One of them knows the truth. Your RatelPoints and rationale are your weapons.",
  meta_capacity: "Round size",
  meta_capacity_value: "{$count} players",
  meta_min_bet: "Bet floor",
  meta_min_bet_value: "{$rp} RP+",
  meta_cycle: "Cycle",
  meta_cycle_value: "1 / day",
  meta_stage_now: "Stage",
  meta_stage_idle: "idle",
  cta_join: "Join round →",
  cta_resume: "Resume round →",
  cta_in_progress: "Round in progress",
  cta_no_subject: "No subject queued",
  status_can_join_new: "Be the first to sit — the round auto-starts at 4 players.",
  status_can_join_existing: "● Live · {$count} players already in",
  status_already_joined: "You're in. Round starts as soon as the lobby fills.",
  status_no_subject: "Operator hasn't queued a subject yet. Check back soon.",
  status_in_progress: "A round is already underway. Wait for it to settle.",
  stats_card_title: "Your stats",
  stats_card_sub: "Lifetime",
  stats_rounds: "Rounds played",
  stats_accuracy: "Accuracy",
  stats_delta: "Lifetime chips",
  stats_last_played: "Last played",
  stats_never: "—",
  history_card_title: "Recent rounds",
  history_card_sub: "Coming soon",
  history_empty: "Per-round history lands when chips → RP redemption ships (v2).",
  catalog_title: "Other games",
  catalog_sub: "Ratel Arcade · {$count} game",
  catalog_tile_status_playing: "PLAYING",
  catalog_tile_status_idle: "IDLE",
  catalog_tile_meta: "Live · 4 players · ~3min",
  lb_section_title: "Accuracy ranking · lifetime",
  lb_section_sub: "10+ rounds played · lifetime",
  lb_head_rank: "#",
  lb_head_name: "Player",
  lb_head_stats: "Participation",
  lb_head_accuracy: "Accuracy",
  lb_head_chips: "Lifetime chips",
  lb_row_stat: "{$total} rounds · {$correct} correct",
  lb_empty: "No leaderboard entries yet — be the first to settle a round.",
  error_join: "Couldn't join the round.",
};

const ko: Record<keyof typeof en, string> = {
  tag_live: "LIVE · 오늘의 라운드 진행 중",
  tag_waiting: "WAITING · 로비 모집 중",
  tag_open: "OPEN · 대상 준비됨",
  tag_closed: "CLOSED · 예정 대상 없음",
  tag_settled: "SETTLED · 라운드 종료",
  featured_title: "Fact or Fold",
  featured_tagline: "4명이 모여 하루 한 건의 뉴스를 판별합니다. 둘 중 한 명은 거짓을 알고 있죠. 당신의 RatelPoint와 근거가 무기입니다.",
  meta_capacity: "라운드 인원",
  meta_capacity_value: "{$count}명",
  meta_min_bet: "베팅 단위",
  meta_min_bet_value: "{$rp} RP+",
  meta_cycle: "라운드 주기",
  meta_cycle_value: "하루 1회",
  meta_stage_now: "현재 단계",
  meta_stage_idle: "대기",
  cta_join: "라운드 입장 →",
  cta_resume: "라운드 복귀 →",
  cta_in_progress: "라운드 진행 중",
  cta_no_subject: "예정된 대상 없음",
  status_can_join_new: "첫 참가자가 됩니다 — 4명이 모이면 자동 시작됩니다.",
  status_can_join_existing: "● 라이브 · 현재 {$count}명 대기 중",
  status_already_joined: "참여 완료. 로비가 채워지면 자동 시작.",
  status_no_subject: "대상이 발행되지 않았습니다. 잠시 후 다시 확인해주세요.",
  status_in_progress: "이미 라운드가 진행 중입니다. 다음 라운드를 기다려주세요.",
  stats_card_title: "나의 통계",
  stats_card_sub: "누적 (lifetime)",
  stats_rounds: "참여 라운드",
  stats_accuracy: "정답률",
  stats_delta: "누적 칩",
  stats_last_played: "마지막 플레이",
  stats_never: "—",
  history_card_title: "최근 라운드",
  history_card_sub: "곧 공개",
  history_empty: "라운드별 기록은 칩→RP 역환전과 함께 v2에서 활성화됩니다.",
  catalog_title: "다른 게임",
  catalog_sub: "라텔 오락실 · {$count}개",
  catalog_tile_status_playing: "PLAYING",
  catalog_tile_status_idle: "IDLE",
  catalog_tile_meta: "라이브 · 4인 · 약 3분",
  lb_section_title: "정확도 랭킹 · 누적",
  lb_section_sub: "최소 10라운드 참여자 · lifetime",
  lb_head_rank: "#",
  lb_head_name: "이름",
  lb_head_stats: "참여",
  lb_head_accuracy: "정답률",
  lb_head_chips: "누적 칩",
  lb_row_stat: "{$total}라운드 · 정답 {$correct}회",
  lb_empty: "리더보드 데이터가 없습니다. 첫 라운드를 끝내고 등재되어 보세요.",
  error_join: "라운드 입장에 실패했습니다.",
};

export const i18n = { en, ko };

export interface ArcadeHomeI18n {
  tagLive: string;
  tagWaiting: string;
  tagOpen: string;
  tagClosed: string;
  tagSettled: string;
  featuredTitle: string;
  featuredTagline: string;
  metaCapacity: string;
  metaCapacityValue: string;
  metaMinBet: string;
  metaMinBetValue: string;
  metaCycle: string;
  metaCycleValue: string;
  metaStageNow: string;
  metaStageIdle: string;
  ctaJoin: string;
  ctaResume: string;
  ctaInProgress: string;
  ctaNoSubject: string;
  statusCanJoinNew: string;
  statusCanJoinExisting: string;
  statusAlreadyJoined: string;
  statusNoSubject: string;
  statusInProgress: string;
  statsCardTitle: string;
  statsCardSub: string;
  statsRounds: string;
  statsAccuracy: string;
  statsDelta: string;
  statsLastPlayed: string;
  statsNever: string;
  historyCardTitle: string;
  historyCardSub: string;
  historyEmpty: string;
  catalogTitle: string;
  catalogSub: string;
  catalogTileStatusPlaying: string;
  catalogTileStatusIdle: string;
  catalogTileMeta: string;
  lbSectionTitle: string;
  lbSectionSub: string;
  lbHeadRank: string;
  lbHeadName: string;
  lbHeadStats: string;
  lbHeadAccuracy: string;
  lbHeadChips: string;
  lbRowStat: string;
  lbEmpty: string;
  errorJoin: string;
}

export function useArcadeHomeI18n(): ArcadeHomeI18n {
  const { t } = useTranslation("arcadeHome");
  return {
    tagLive: t("tag_live"),
    tagWaiting: t("tag_waiting"),
    tagOpen: t("tag_open"),
    tagClosed: t("tag_closed"),
    tagSettled: t("tag_settled"),
    featuredTitle: t("featured_title"),
    featuredTagline: t("featured_tagline"),
    metaCapacity: t("meta_capacity"),
    metaCapacityValue: t("meta_capacity_value"),
    metaMinBet: t("meta_min_bet"),
    metaMinBetValue: t("meta_min_bet_value"),
    metaCycle: t("meta_cycle"),
    metaCycleValue: t("meta_cycle_value"),
    metaStageNow: t("meta_stage_now"),
    metaStageIdle: t("meta_stage_idle"),
    ctaJoin: t("cta_join"),
    ctaResume: t("cta_resume"),
    ctaInProgress: t("cta_in_progress"),
    ctaNoSubject: t("cta_no_subject"),
    statusCanJoinNew: t("status_can_join_new"),
    statusCanJoinExisting: t("status_can_join_existing"),
    statusAlreadyJoined: t("status_already_joined"),
    statusNoSubject: t("status_no_subject"),
    statusInProgress: t("status_in_progress"),
    statsCardTitle: t("stats_card_title"),
    statsCardSub: t("stats_card_sub"),
    statsRounds: t("stats_rounds"),
    statsAccuracy: t("stats_accuracy"),
    statsDelta: t("stats_delta"),
    statsLastPlayed: t("stats_last_played"),
    statsNever: t("stats_never"),
    historyCardTitle: t("history_card_title"),
    historyCardSub: t("history_card_sub"),
    historyEmpty: t("history_empty"),
    catalogTitle: t("catalog_title"),
    catalogSub: t("catalog_sub"),
    catalogTileStatusPlaying: t("catalog_tile_status_playing"),
    catalogTileStatusIdle: t("catalog_tile_status_idle"),
    catalogTileMeta: t("catalog_tile_meta"),
    lbSectionTitle: t("lb_section_title"),
    lbSectionSub: t("lb_section_sub"),
    lbHeadRank: t("lb_head_rank"),
    lbHeadName: t("lb_head_name"),
    lbHeadStats: t("lb_head_stats"),
    lbHeadAccuracy: t("lb_head_accuracy"),
    lbHeadChips: t("lb_head_chips"),
    lbRowStat: t("lb_row_stat"),
    lbEmpty: t("lb_empty"),
    errorJoin: t("error_join"),
  };
}
