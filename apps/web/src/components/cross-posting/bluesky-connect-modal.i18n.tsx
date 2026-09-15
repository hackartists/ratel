// Ported from: app/ratel/src/features/cross_posting/i18n.rs (`BlueskyConnectModalTranslate`). Namespace "blueskyConnectModal".
import { useTranslation } from "react-i18next";

const en = {
  title: "Connect Bluesky",
  subtitle: "Enter your handle + app password",
  close: "Close",
  info: "Bluesky uses app passwords, not OAuth. Generate one at bsky.app/settings/app-passwords — we store it encrypted and never see your main password.",
  label_handle: "Handle",
  placeholder_handle: "you.bsky.social",
  hint_handle: "Your Bluesky handle — don't include @",
  label_app_password: "App password",
  placeholder_app_password: "xxxx-xxxx-xxxx-xxxx",
  hint_app_password: "Format: xxxx-xxxx-xxxx-xxxx. Revokable anytime from Bluesky settings.",
  foot_hint: "Encrypted at rest · revocable anytime",
  btn_cancel: "Cancel",
  btn_connect: "Connect",
};

const ko: Record<keyof typeof en, string> = {
  title: "Bluesky 연결",
  subtitle: "핸들 + 앱 비밀번호 입력",
  close: "닫기",
  info: "Bluesky 는 OAuth 대신 앱 비밀번호 방식을 사용합니다. bsky.app/settings/app-passwords 에서 발급받아 입력하세요. 암호화 저장하며 메인 비밀번호는 절대 알 수 없습니다.",
  label_handle: "핸들",
  placeholder_handle: "you.bsky.social",
  hint_handle: "Bluesky 핸들 — @ 빼고 입력",
  label_app_password: "앱 비밀번호",
  placeholder_app_password: "xxxx-xxxx-xxxx-xxxx",
  hint_app_password: "형식: xxxx-xxxx-xxxx-xxxx. Bluesky 설정에서 언제든 폐기 가능.",
  foot_hint: "저장 시 암호화 · 언제든 폐기",
  btn_cancel: "취소",
  btn_connect: "연결하기",
};

export const i18n = { en, ko };

export interface BlueskyConnectModalI18n {
  title: string;
  subtitle: string;
  close: string;
  info: string;
  labelHandle: string;
  placeholderHandle: string;
  hintHandle: string;
  labelAppPassword: string;
  placeholderAppPassword: string;
  hintAppPassword: string;
  footHint: string;
  btnCancel: string;
  btnConnect: string;
}

export function useBlueskyConnectModalI18n(): BlueskyConnectModalI18n {
  const { t } = useTranslation("blueskyConnectModal");
  return {
    title: t("title"),
    subtitle: t("subtitle"),
    close: t("close"),
    info: t("info"),
    labelHandle: t("label_handle"),
    placeholderHandle: t("placeholder_handle"),
    hintHandle: t("hint_handle"),
    labelAppPassword: t("label_app_password"),
    placeholderAppPassword: t("placeholder_app_password"),
    hintAppPassword: t("hint_app_password"),
    footHint: t("foot_hint"),
    btnCancel: t("btn_cancel"),
    btnConnect: t("btn_connect"),
  };
}
