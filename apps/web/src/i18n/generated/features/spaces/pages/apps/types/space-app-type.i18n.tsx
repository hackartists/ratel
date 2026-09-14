// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/spaces/pages/apps/types/space_app_type.rs (`SpaceAppTypeTranslate`). Namespace "spaceAppType".
import { useTranslation } from "react-i18next";

const en = {
  app_description_incentive_pool: "An incentive granted by the space creator, and granted upon finising according to the incentive rules",
  app_description_file: "Manage and organize files shared in your space.",
  app_description_panels: "Configure panel participation rules",
  app_description_general: "Settings (Admin)",
  app_description_analyzes: "Check out the poll results.",
  app_description_report: "Compose and publish reports from analyze data.",
};

const ko: Record<keyof typeof en, string> = {
  app_description_incentive_pool: "스페이스 생성자가 부여하는 인센티브로 종료 시 인센티브 규칙에 따라 부여됩니다.",
  app_description_file: "스페이스에서 공유되는 파일을 관리하고 정리하세요.",
  app_description_panels: "패널 참여 조건을 설정하세요.",
  app_description_general: "설정(관리자)",
  app_description_analyzes: "설문조사 결과를 확인하세요.",
  app_description_report: "분석 데이터를 기반으로 보고서를 작성·발행하세요.",
};

export const i18n = { en, ko };

export interface SpaceAppTypeI18n {
  appDescriptionIncentivePool: string;
  appDescriptionFile: string;
  appDescriptionPanels: string;
  appDescriptionGeneral: string;
  appDescriptionAnalyzes: string;
  appDescriptionReport: string;
}

export function useSpaceAppTypeI18n(): SpaceAppTypeI18n {
  const { t } = useTranslation("spaceAppType");
  return {
    appDescriptionIncentivePool: t("app_description_incentive_pool"),
    appDescriptionFile: t("app_description_file"),
    appDescriptionPanels: t("app_description_panels"),
    appDescriptionGeneral: t("app_description_general"),
    appDescriptionAnalyzes: t("app_description_analyzes"),
    appDescriptionReport: t("app_description_report"),
  };
}
