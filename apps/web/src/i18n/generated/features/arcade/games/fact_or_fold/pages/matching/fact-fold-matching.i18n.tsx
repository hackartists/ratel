// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/arcade/games/fact_or_fold/pages/matching/i18n.rs (`FactFoldMatchingTranslate`). Namespace "factFoldMatching".
import { useTranslation } from "react-i18next";

const en = {
  eyebrow_waiting: "Matching · auto-starts at {$capacity}",
  eyebrow_full: "Matched · entering the round",
  eyebrow_no_round: "No active round — head back home.",
  title: "FACT OR FOLD",
  subtitle: "Today's subject is revealed when the round begins. One of you will be the truth insider — the other three must judge.",
  buyin_note: "Buy-in {$chips} chips already escrowed · refunded if you cancel",
  slot_empty: "Waiting…",
  slot_pill_empty: "EMPTY",
  slot_pill_ready: "READY",
  slot_seat: "SEAT {$n}",
  you_tag: "YOU",
  progress_label: "Lobby fill",
  progress_count: "{$current} / {$capacity}",
  hint_timing_strong: "~3 min",
  hint_timing_body: ": news 30s · bet 10s · rationale 30s · reveal 20s · debate 70s · settle.",
  hint_insider_strong: "1 insider",
  hint_insider_body: ": knows the truth, must sway the other 3 to score the bonus.",
  hint_persuade_strong: "Persuasive rationale",
  hint_persuade_body: " wins RP. One bet-flip slot in the last 10s of debate.",
  cancel_btn: "Cancel · refund chips",
  cancel_hint: "Round auto-starts the moment the seats fill — you'll jump straight in.",
  leave_error: "Couldn't cancel — try again.",
};

const ko: Record<keyof typeof en, string> = {
  eyebrow_waiting: "매칭 중 · {$capacity}명이 모이면 자동 시작",
  eyebrow_full: "매칭 완료 · 라운드 시작",
  eyebrow_no_round: "참여 중인 라운드가 없습니다 — 홈으로 돌아가세요.",
  title: "FACT OR FOLD",
  subtitle: "오늘의 뉴스는 라운드 시작 시 공개됩니다. 4명 중 1명이 무작위로 진실 인사이더가 되고, 나머지 3명이 베팅과 근거로 판별합니다.",
  buyin_note: "buy-in {$chips} 칩 이미 예치됨 · 라운드 종료 시 결과만큼 환원",
  slot_empty: "대기 중…",
  slot_pill_empty: "EMPTY",
  slot_pill_ready: "READY",
  slot_seat: "SEAT {$n}",
  you_tag: "YOU",
  progress_label: "모임 진행",
  progress_count: "{$current} / {$capacity}",
  hint_timing_strong: "약 3분",
  hint_timing_body: ": 뉴스 30s · 베팅 10s · 근거 30s · 공개 20s · 토론 70s · 정산",
  hint_insider_strong: "1명은 인사이더",
  hint_insider_body: ": 진실을 알지만 다른 3명을 흔들어야 보너스를 얻습니다.",
  hint_persuade_strong: "설득력 있는 근거",
  hint_persuade_body: "가 RP를 만듭니다. 토론 마지막 10초에 베팅 변경 슬롯 1회.",
  cancel_btn: "매칭 취소 · 칩 환불",
  cancel_hint: "4명 모이는 즉시 자동으로 라운드 화면으로 이동합니다.",
  leave_error: "취소에 실패했습니다. 다시 시도해주세요.",
};

export const i18n = { en, ko };

export interface FactFoldMatchingI18n {
  eyebrowWaiting: string;
  eyebrowFull: string;
  eyebrowNoRound: string;
  title: string;
  subtitle: string;
  buyinNote: string;
  slotEmpty: string;
  slotPillEmpty: string;
  slotPillReady: string;
  slotSeat: string;
  youTag: string;
  progressLabel: string;
  progressCount: string;
  hintTimingStrong: string;
  hintTimingBody: string;
  hintInsiderStrong: string;
  hintInsiderBody: string;
  hintPersuadeStrong: string;
  hintPersuadeBody: string;
  cancelBtn: string;
  cancelHint: string;
  leaveError: string;
}

export function useFactFoldMatchingI18n(): FactFoldMatchingI18n {
  const { t } = useTranslation("factFoldMatching");
  return {
    eyebrowWaiting: t("eyebrow_waiting"),
    eyebrowFull: t("eyebrow_full"),
    eyebrowNoRound: t("eyebrow_no_round"),
    title: t("title"),
    subtitle: t("subtitle"),
    buyinNote: t("buyin_note"),
    slotEmpty: t("slot_empty"),
    slotPillEmpty: t("slot_pill_empty"),
    slotPillReady: t("slot_pill_ready"),
    slotSeat: t("slot_seat"),
    youTag: t("you_tag"),
    progressLabel: t("progress_label"),
    progressCount: t("progress_count"),
    hintTimingStrong: t("hint_timing_strong"),
    hintTimingBody: t("hint_timing_body"),
    hintInsiderStrong: t("hint_insider_strong"),
    hintInsiderBody: t("hint_insider_body"),
    hintPersuadeStrong: t("hint_persuade_strong"),
    hintPersuadeBody: t("hint_persuade_body"),
    cancelBtn: t("cancel_btn"),
    cancelHint: t("cancel_hint"),
    leaveError: t("leave_error"),
  };
}
