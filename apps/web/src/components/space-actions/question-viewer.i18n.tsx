// Ported from: app/ratel/src/features/spaces/pages/actions/actions/poll/components/question_viewer.rs (`QuestionViewerTranslate`). Namespace "questionViewer".
import { useTranslation } from "react-i18next";

const en = {
  btn_back: "Back",
  btn_next: "Next",
  subjective_input_placeholder: "Write your answer...",
  other_option: "Other",
  other_placeholder: "Write your answer...",
  privacy_consent_agree_label: "I have read the terms above and agree to provide my phone number for this purpose.",
  privacy_consent_change_btn: "Change",
  privacy_consent_verified_label: "Verified",
  privacy_consent_not_verified_label: "Not verified yet",
  privacy_consent_phone_label: "Phone number",
  privacy_consent_phone_placeholder: "010-0000-0000",
  privacy_consent_send_code_btn: "Send code",
  privacy_consent_code_label: "Verification code",
  privacy_consent_code_placeholder: "6-digit code",
  privacy_consent_verify_btn: "Verify",
  privacy_consent_verify_error: "Invalid or expired code. Please try again.",
  privacy_consent_send_code_error: "Failed to send verification code.",
};

const ko: Record<keyof typeof en, string> = {
  btn_back: "뒤로",
  btn_next: "다음",
  subjective_input_placeholder: "답변을 입력하세요...",
  other_option: "기타",
  other_placeholder: "응답을 입력하세요...",
  privacy_consent_agree_label: "위 약관을 읽었으며 이 목적으로 휴대폰 번호를 제공하는 데 동의합니다.",
  privacy_consent_change_btn: "변경하기",
  privacy_consent_verified_label: "인증됨",
  privacy_consent_not_verified_label: "아직 인증되지 않음",
  privacy_consent_phone_label: "휴대폰 번호",
  privacy_consent_phone_placeholder: "010-0000-0000",
  privacy_consent_send_code_btn: "코드 전송",
  privacy_consent_code_label: "인증 코드",
  privacy_consent_code_placeholder: "6자리 코드",
  privacy_consent_verify_btn: "인증",
  privacy_consent_verify_error: "코드가 유효하지 않거나 만료되었습니다. 다시 시도해주세요.",
  privacy_consent_send_code_error: "인증 코드 전송에 실패했습니다.",
};

export const i18n = { en, ko };

export interface QuestionViewerI18n {
  btnBack: string;
  btnNext: string;
  subjectiveInputPlaceholder: string;
  otherOption: string;
  otherPlaceholder: string;
  privacyConsentAgreeLabel: string;
  privacyConsentChangeBtn: string;
  privacyConsentVerifiedLabel: string;
  privacyConsentNotVerifiedLabel: string;
  privacyConsentPhoneLabel: string;
  privacyConsentPhonePlaceholder: string;
  privacyConsentSendCodeBtn: string;
  privacyConsentCodeLabel: string;
  privacyConsentCodePlaceholder: string;
  privacyConsentVerifyBtn: string;
  privacyConsentVerifyError: string;
  privacyConsentSendCodeError: string;
}

export function useQuestionViewerI18n(): QuestionViewerI18n {
  const { t } = useTranslation("questionViewer");
  return {
    btnBack: t("btn_back"),
    btnNext: t("btn_next"),
    subjectiveInputPlaceholder: t("subjective_input_placeholder"),
    otherOption: t("other_option"),
    otherPlaceholder: t("other_placeholder"),
    privacyConsentAgreeLabel: t("privacy_consent_agree_label"),
    privacyConsentChangeBtn: t("privacy_consent_change_btn"),
    privacyConsentVerifiedLabel: t("privacy_consent_verified_label"),
    privacyConsentNotVerifiedLabel: t("privacy_consent_not_verified_label"),
    privacyConsentPhoneLabel: t("privacy_consent_phone_label"),
    privacyConsentPhonePlaceholder: t("privacy_consent_phone_placeholder"),
    privacyConsentSendCodeBtn: t("privacy_consent_send_code_btn"),
    privacyConsentCodeLabel: t("privacy_consent_code_label"),
    privacyConsentCodePlaceholder: t("privacy_consent_code_placeholder"),
    privacyConsentVerifyBtn: t("privacy_consent_verify_btn"),
    privacyConsentVerifyError: t("privacy_consent_verify_error"),
    privacyConsentSendCodeError: t("privacy_consent_send_code_error"),
  };
}
