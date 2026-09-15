// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/spaces/space_common/components/space_nav/participation_verification_section.rs (`ParticipationVerificationSectionTranslate`). Namespace "participationVerificationSection".
import { useTranslation } from "react-i18next";

const en = {
  title: "Match Required Attributes",
  method_title: "Choose a verification method",
  method_description: "Select how you want to verify the required attributes for this space.",
  portone_title: "Identity Verification",
  portone_description: "Use identity verification to import the required attributes into your credential.",
  import_title: "Attributes to import from the method",
  import_description: "These attributes will be read during verification and added to your credential with your consent.",
  notice: "You can remove or edit these attributes later from your credential settings.",
  back: "Back",
  continue_label: "Continue",
  verification_failed: "Some required attributes are still missing. Your credential has not been updated enough for this space yet.",
  age: "Age",
  gender: "Gender",
  university: "University",
};

const ko: Record<keyof typeof en, string> = {
  title: "필수 속성 일치",
  method_title: "인증 방법 선택",
  method_description: "이 스페이스에 필요한 속성을 어떤 방식으로 인증할지 선택하세요.",
  portone_title: "본인 인증",
  portone_description: "본인 인증으로 필요한 속성을 Credential에 가져옵니다.",
  import_title: "이 방법으로 가져올 속성",
  import_description: "이 속성들은 인증 과정에서 읽혀지고, 동의 후 Credential에 추가됩니다.",
  notice: "이 속성들은 나중에 Credential 설정에서 수정하거나 제거할 수 있습니다.",
  back: "뒤로",
  continue_label: "계속하기",
  verification_failed: "일부 필수 속성이 아직 부족합니다. 현재 Credential로는 이 스페이스 조건을 아직 충족하지 못했습니다.",
  age: "나이",
  gender: "성별",
  university: "대학교",
};

export const i18n = { en, ko };

export interface ParticipationVerificationSectionI18n {
  title: string;
  methodTitle: string;
  methodDescription: string;
  portoneTitle: string;
  portoneDescription: string;
  importTitle: string;
  importDescription: string;
  notice: string;
  back: string;
  continueLabel: string;
  verificationFailed: string;
  age: string;
  gender: string;
  university: string;
}

export function useParticipationVerificationSectionI18n(): ParticipationVerificationSectionI18n {
  const { t } = useTranslation("participationVerificationSection");
  return {
    title: t("title"),
    methodTitle: t("method_title"),
    methodDescription: t("method_description"),
    portoneTitle: t("portone_title"),
    portoneDescription: t("portone_description"),
    importTitle: t("import_title"),
    importDescription: t("import_description"),
    notice: t("notice"),
    back: t("back"),
    continueLabel: t("continue_label"),
    verificationFailed: t("verification_failed"),
    age: t("age"),
    gender: t("gender"),
    university: t("university"),
  };
}
