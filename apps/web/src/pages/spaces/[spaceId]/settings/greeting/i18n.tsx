/** Strings of the full-page waiting greeting editor. Namespace "spaceGreetingSettings". */
import { useTranslation } from "react-i18next";

const en = {
  breadcrumb_settings: "Settings",
  breadcrumb_greeting: "Greeting",
  type_badge: "Greeting",
  topbar_title: "Greeting settings",
  back_aria: "Go back",
  heading: "Waiting greeting",
  label: "Greeting",
  description: "Shown to participants who finished the prerequisites while they wait for the space to start.",
  placeholder: "Write a greeting for participants...",
  locked: "The space has started, so the greeting can no longer be changed.",
  save: "Save",
  saving: "Saving...",
  saved: "Greeting saved",
  status_dirty: "Unsaved changes",
  status_clean: "Saved",
  status_locked: "Read-only",
  no_access: "Only the space creator can edit the greeting.",
  viewer_back: "Go back",
};

const ko: Record<keyof typeof en, string> = {
  breadcrumb_settings: "설정",
  breadcrumb_greeting: "인사말",
  type_badge: "인사말",
  topbar_title: "인사말 설정",
  back_aria: "뒤로 가기",
  heading: "대기 인사말",
  label: "인사말",
  description: "사전 조건을 완료한 참여자가 스페이스 시작을 기다리는 동안 보게 되는 인사말입니다.",
  placeholder: "참여자에게 보여줄 인사말을 입력하세요...",
  locked: "스페이스가 시작되어 더 이상 인사말을 변경할 수 없습니다.",
  save: "저장",
  saving: "저장 중...",
  saved: "인사말이 저장되었습니다",
  status_dirty: "저장되지 않은 변경 사항",
  status_clean: "저장됨",
  status_locked: "읽기 전용",
  no_access: "스페이스 생성자만 인사말을 편집할 수 있습니다.",
  viewer_back: "뒤로 가기",
};

export const i18n = { en, ko };

export interface SpaceGreetingSettingsI18n {
  breadcrumbSettings: string;
  breadcrumbGreeting: string;
  typeBadge: string;
  topbarTitle: string;
  backAria: string;
  heading: string;
  label: string;
  description: string;
  placeholder: string;
  locked: string;
  save: string;
  saving: string;
  saved: string;
  statusDirty: string;
  statusClean: string;
  statusLocked: string;
  noAccess: string;
  viewerBack: string;
}

export function useSpaceGreetingSettingsI18n(): SpaceGreetingSettingsI18n {
  const { t } = useTranslation("spaceGreetingSettings");
  return {
    breadcrumbSettings: t("breadcrumb_settings"),
    breadcrumbGreeting: t("breadcrumb_greeting"),
    typeBadge: t("type_badge"),
    topbarTitle: t("topbar_title"),
    backAria: t("back_aria"),
    heading: t("heading"),
    label: t("label"),
    description: t("description"),
    placeholder: t("placeholder"),
    locked: t("locked"),
    save: t("save"),
    saving: t("saving"),
    saved: t("saved"),
    statusDirty: t("status_dirty"),
    statusClean: t("status_clean"),
    statusLocked: t("status_locked"),
    noAccess: t("no_access"),
    viewerBack: t("viewer_back"),
  };
}
