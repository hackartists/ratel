// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/spaces/space_common/components/space_nav/participation_consent_section.rs (`ParticipationAttributesSectionTranslate`). Namespace "spaceNavParticipationConsentSectionParticipationAttributesSection".
import { useTranslation } from "react-i18next";

const en = {
  partial_match_title: "Your Attributes is a Partial Match",
  full_match_title: "Your Attributes Match",
  missing_notice: "Some required attributes are missing for this space",
  requirements_to_unlock: "Requirements to Unlock",
  requirements_description: "To join this space, certain attributes are required. You must meet the requirements below to unlock access.",
  improve_my_credential: "Improve My Credential",
  consent_label: "I understand and agree to verify the required attributes for this Space.",
  join_space: "Join Space",
  age: "Age",
  gender: "Gender",
  university: "University",
  gender_male: "Male",
  gender_female: "Female",
  verification_required: "Verification required",
};

const ko: Record<keyof typeof en, string> = {
  partial_match_title: "속성이 일부 일치합니다",
  full_match_title: "속성이 모두 일치합니다",
  missing_notice: "이 스페이스에 필요한 속성이 부족합니다",
  requirements_to_unlock: "잠금 해제 요건",
  requirements_description: "이 스페이스에 참여하려면 특정 속성이 필요합니다. 아래 요건을 충족해야 접근이 가능합니다.",
  improve_my_credential: "내 Credential 개선하기",
  consent_label: "이 스페이스에 필요한 속성의 검증에 동의합니다.",
  join_space: "스페이스 참여",
  age: "나이",
  gender: "성별",
  university: "대학교",
  gender_male: "남성",
  gender_female: "여성",
  verification_required: "인증 필요",
};

export const i18n = { en, ko };

export interface SpaceNavParticipationConsentSectionParticipationAttributesSectionI18n {
  partialMatchTitle: string;
  fullMatchTitle: string;
  missingNotice: string;
  requirementsToUnlock: string;
  requirementsDescription: string;
  improveMyCredential: string;
  consentLabel: string;
  joinSpace: string;
  age: string;
  gender: string;
  university: string;
  genderMale: string;
  genderFemale: string;
  verificationRequired: string;
}

export function useSpaceNavParticipationConsentSectionParticipationAttributesSectionI18n(): SpaceNavParticipationConsentSectionParticipationAttributesSectionI18n {
  const { t } = useTranslation("spaceNavParticipationConsentSectionParticipationAttributesSection");
  return {
    partialMatchTitle: t("partial_match_title"),
    fullMatchTitle: t("full_match_title"),
    missingNotice: t("missing_notice"),
    requirementsToUnlock: t("requirements_to_unlock"),
    requirementsDescription: t("requirements_description"),
    improveMyCredential: t("improve_my_credential"),
    consentLabel: t("consent_label"),
    joinSpace: t("join_space"),
    age: t("age"),
    gender: t("gender"),
    university: t("university"),
    genderMale: t("gender_male"),
    genderFemale: t("gender_female"),
    verificationRequired: t("verification_required"),
  };
}
