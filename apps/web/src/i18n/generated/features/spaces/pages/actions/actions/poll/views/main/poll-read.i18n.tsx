// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/spaces/pages/actions/actions/poll/views/main/poll_read_page.rs (`PollReadTranslate`). Namespace "pollRead".
import { useTranslation } from "react-i18next";

const en = {
  btn_next: "Next",
  btn_back: "Back",
  btn_cancel: "Cancel",
  btn_submit: "Submit",
  btn_update: "Update",
  poll_ended: "This poll has ended.",
  poll_not_started: "This poll has not started yet.",
  no_permission: "You do not have permission to participate in this poll.",
  already_responded: "You have already participated in this poll.",
  question_label: "Question",
  no_questions: "No questions yet.",
  submit_success: "Response submitted successfully.",
  submit_confirm_title: "Submit response",
  submit_confirm_description: "Once submitted, this response cannot be edited. Do you want to submit?",
  submit_confirm_cancel: "Cancel",
  submit_confirm_action: "Submit",
  encrypted_verify_title: "Encrypted vote verification",
  encrypted_verify_description: "Enter a local secret to encrypt your poll-specific voter key in this browser and decrypt your on-chain ballot locally.",
  encrypted_verify_session_description: "A local secret is remembered for this browser session and will be reused for other encrypted polls.",
  encrypted_verify_secret_placeholder: "Local secret",
  encrypted_verify_session_active: "Using the local secret saved for this browser session.",
  encrypted_verify_change_secret: "Change secret",
  encrypted_verify_button: "Save key and verify",
  encrypted_verify_success: "Vote verified locally.",
  encrypted_verify_error: "Local vote verification failed.",
  encrypted_verify_decrypted: "Decrypted answer",
  encrypted_secret_modal_title: "Set up encrypted voting",
  encrypted_secret_modal_description: "This poll uses end-to-end encryption. Set a local secret used to derive your voter key in this browser. The same secret will let you verify your ballot later. The secret never leaves your device.",
  encrypted_secret_modal_placeholder: "Local secret",
  encrypted_secret_modal_continue: "Continue",
  encrypted_secret_modal_cancel: "Cancel",
  encrypted_secret_required: "Encrypted polls require a local secret before submitting.",
  encrypted_material_load_failed: "Failed to load encryption material.",
};

const ko: Record<keyof typeof en, string> = {
  btn_next: "다음",
  btn_back: "뒤로",
  btn_cancel: "취소",
  btn_submit: "제출",
  btn_update: "수정",
  poll_ended: "이 투표가 종료되었습니다.",
  poll_not_started: "이 투표는 아직 시작되지 않았습니다.",
  no_permission: "이 투표에 참여할 권한이 없습니다.",
  already_responded: "이미 이 투표에 참여했습니다.",
  question_label: "질문",
  no_questions: "아직 질문이 없습니다.",
  submit_success: "응답이 성공적으로 제출되었습니다.",
  submit_confirm_title: "응답 제출",
  submit_confirm_description: "한번 제출한 응답은 수정이 불가능합니다. 제출하시겠습니까?",
  submit_confirm_cancel: "취소",
  submit_confirm_action: "제출",
  encrypted_verify_title: "암호화 투표 검증",
  encrypted_verify_description: "로컬 시크릿을 입력하면 이 브라우저에 투표별 복호화 키를 암호화해 저장하고 온체인 투표를 로컬에서 복호화합니다.",
  encrypted_verify_session_description: "이 브라우저 세션 동안 로컬 시크릿을 기억하고 다른 암호화 Poll에도 재사용합니다.",
  encrypted_verify_secret_placeholder: "로컬 시크릿",
  encrypted_verify_session_active: "이 브라우저 세션에 저장된 로컬 시크릿을 사용 중입니다.",
  encrypted_verify_change_secret: "시크릿 변경",
  encrypted_verify_button: "키 저장 및 검증",
  encrypted_verify_success: "투표를 로컬에서 검증했습니다.",
  encrypted_verify_error: "로컬 투표 검증에 실패했습니다.",
  encrypted_verify_decrypted: "복호화된 답변",
  encrypted_secret_modal_title: "암호화 투표 설정",
  encrypted_secret_modal_description: "이 투표는 종단 간 암호화를 사용합니다. 이 브라우저에서 투표자 키를 파생하는 데 쓸 로컬 시크릿을 설정하세요. 동일한 시크릿으로 나중에 투표를 검증할 수 있습니다. 시크릿은 기기를 떠나지 않습니다.",
  encrypted_secret_modal_placeholder: "로컬 시크릿",
  encrypted_secret_modal_continue: "계속",
  encrypted_secret_modal_cancel: "취소",
  encrypted_secret_required: "암호화 투표는 제출 전에 로컬 시크릿 설정이 필요합니다.",
  encrypted_material_load_failed: "암호화 자료 로드에 실패했습니다.",
};

export const i18n = { en, ko };

export interface PollReadI18n {
  btnNext: string;
  btnBack: string;
  btnCancel: string;
  btnSubmit: string;
  btnUpdate: string;
  pollEnded: string;
  pollNotStarted: string;
  noPermission: string;
  alreadyResponded: string;
  questionLabel: string;
  noQuestions: string;
  submitSuccess: string;
  submitConfirmTitle: string;
  submitConfirmDescription: string;
  submitConfirmCancel: string;
  submitConfirmAction: string;
  encryptedVerifyTitle: string;
  encryptedVerifyDescription: string;
  encryptedVerifySessionDescription: string;
  encryptedVerifySecretPlaceholder: string;
  encryptedVerifySessionActive: string;
  encryptedVerifyChangeSecret: string;
  encryptedVerifyButton: string;
  encryptedVerifySuccess: string;
  encryptedVerifyError: string;
  encryptedVerifyDecrypted: string;
  encryptedSecretModalTitle: string;
  encryptedSecretModalDescription: string;
  encryptedSecretModalPlaceholder: string;
  encryptedSecretModalContinue: string;
  encryptedSecretModalCancel: string;
  encryptedSecretRequired: string;
  encryptedMaterialLoadFailed: string;
}

export function usePollReadI18n(): PollReadI18n {
  const { t } = useTranslation("pollRead");
  return {
    btnNext: t("btn_next"),
    btnBack: t("btn_back"),
    btnCancel: t("btn_cancel"),
    btnSubmit: t("btn_submit"),
    btnUpdate: t("btn_update"),
    pollEnded: t("poll_ended"),
    pollNotStarted: t("poll_not_started"),
    noPermission: t("no_permission"),
    alreadyResponded: t("already_responded"),
    questionLabel: t("question_label"),
    noQuestions: t("no_questions"),
    submitSuccess: t("submit_success"),
    submitConfirmTitle: t("submit_confirm_title"),
    submitConfirmDescription: t("submit_confirm_description"),
    submitConfirmCancel: t("submit_confirm_cancel"),
    submitConfirmAction: t("submit_confirm_action"),
    encryptedVerifyTitle: t("encrypted_verify_title"),
    encryptedVerifyDescription: t("encrypted_verify_description"),
    encryptedVerifySessionDescription: t("encrypted_verify_session_description"),
    encryptedVerifySecretPlaceholder: t("encrypted_verify_secret_placeholder"),
    encryptedVerifySessionActive: t("encrypted_verify_session_active"),
    encryptedVerifyChangeSecret: t("encrypted_verify_change_secret"),
    encryptedVerifyButton: t("encrypted_verify_button"),
    encryptedVerifySuccess: t("encrypted_verify_success"),
    encryptedVerifyError: t("encrypted_verify_error"),
    encryptedVerifyDecrypted: t("encrypted_verify_decrypted"),
    encryptedSecretModalTitle: t("encrypted_secret_modal_title"),
    encryptedSecretModalDescription: t("encrypted_secret_modal_description"),
    encryptedSecretModalPlaceholder: t("encrypted_secret_modal_placeholder"),
    encryptedSecretModalContinue: t("encrypted_secret_modal_continue"),
    encryptedSecretModalCancel: t("encrypted_secret_modal_cancel"),
    encryptedSecretRequired: t("encrypted_secret_required"),
    encryptedMaterialLoadFailed: t("encrypted_material_load_failed"),
  };
}
