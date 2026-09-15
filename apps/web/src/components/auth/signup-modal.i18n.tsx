// Ported from: app/ratel/src/features/auth/components/sign_up_modal/mod.rs (`SignupModalTranslate`). Namespace "signupModal".
import { useTranslation } from "react-i18next";

const en = {
  wallet_address: "Wallet Address",
  email: "Email",
  send: "Send",
  verify: "Verify",
  verification_code: "Verification Code",
  password: "Password",
  password_placeholder: "Enter your password",
  confirm_password: "Confirm Password",
  confirm_password_placeholder: "Re-enter your password",
  password_mismatch: "Passwords do not match.",
  display_name: "Display Name",
  display_name_placeholder: "Enter your display name",
  user_name: "User Name",
  username_placeholder: "Enter your user name",
  email_placeholder: "Enter your email address",
  code_placeholder: "Enter the verification code",
  agree_tos_required: "[Required] ",
  agree_tos_text: "I have read and accept the Terms of Service.",
  agree_news: "I want to receive announcements and news from Ratel.",
  finish_signup: "Finished Sign-up",
  loading: "Loading...",
  invalid_password_format: "Password must contain letters, numbers, and special characters (min 8 chars).",
  invalid_username_format: "Only numbers, lowercase letters, -, _ and more than one character can be entered.",
  invalid_email_format: "Please enter a valid email address.",
  terms_required: "You must agree to the Terms of Service to proceed.",
  clicked_image: "Click to change profile image",
  privacy_policy: "Privacy Policy",
  terms_of_service: "Terms of Service",
  child_safety: "Child Safety",
  failed_send_code: "Failed to send verification code",
  email_already_registered: "This email is already registered. Please use Forgot Password.",
  username_already_exists: "This username already exists.",
  failed_verify_code: "Verification code is incorrect or has expired",
};

const ko: Record<keyof typeof en, string> = {
  wallet_address: "지갑 주소",
  email: "이메일",
  send: "전송하기",
  verify: "인증하기",
  verification_code: "인증 코드",
  password: "비밀번호",
  password_placeholder: "비밀번호를 입력하세요",
  confirm_password: "비밀번호 확인",
  confirm_password_placeholder: "비밀번호를 다시 입력하세요",
  password_mismatch: "비밀번호가 일치하지 않습니다.",
  display_name: "이름",
  display_name_placeholder: "이름을 입력하세요",
  user_name: "사용자 이름",
  username_placeholder: "사용자 이름을 입력하세요",
  email_placeholder: "이메일 주소를 입력하세요",
  code_placeholder: "인증 코드를 입력하세요",
  agree_tos_required: "[필수] ",
  agree_tos_text: "서비스 이용약관을 읽고 동의합니다.",
  agree_news: "Ratel의 공지사항과 소식을 받아보고 싶습니다.",
  finish_signup: "회원가입하기",
  loading: "로딩 중...",
  invalid_password_format: "비밀번호는 문자, 숫자, 특수문자를 포함하여 최소 8자 이상이어야 합니다.",
  invalid_username_format: "숫자, 소문자, -, _ 및 두 글자 이상만 입력할 수 있습니다.",
  invalid_email_format: "유효한 이메일 주소를 입력해주세요.",
  terms_required: "서비스 이용약관에 동의해야 진행할 수 있습니다.",
  clicked_image: "프로필 이미지 변경 클릭",
  privacy_policy: "개인정보 처리방침",
  terms_of_service: "서비스 이용약관",
  child_safety: "아동 안전 기준",
  failed_send_code: "인증 코드 전송에 실패했습니다",
  email_already_registered: "이미 등록된 이메일입니다. 비밀번호 찾기를 이용해주세요.",
  username_already_exists: "이미 존재하는 유저이름입니다.",
  failed_verify_code: "인증 코드가 올바르지 않거나 만료되었습니다",
};

export const i18n = { en, ko };

export interface SignupModalI18n {
  walletAddress: string;
  email: string;
  send: string;
  verify: string;
  verificationCode: string;
  password: string;
  passwordPlaceholder: string;
  confirmPassword: string;
  confirmPasswordPlaceholder: string;
  passwordMismatch: string;
  displayName: string;
  displayNamePlaceholder: string;
  userName: string;
  usernamePlaceholder: string;
  emailPlaceholder: string;
  codePlaceholder: string;
  agreeTosRequired: string;
  agreeTosText: string;
  agreeNews: string;
  finishSignup: string;
  loading: string;
  invalidPasswordFormat: string;
  invalidUsernameFormat: string;
  invalidEmailFormat: string;
  termsRequired: string;
  clickedImage: string;
  privacyPolicy: string;
  termsOfService: string;
  childSafety: string;
  failedSendCode: string;
  emailAlreadyRegistered: string;
  usernameAlreadyExists: string;
  failedVerifyCode: string;
}

export function useSignupModalI18n(): SignupModalI18n {
  const { t } = useTranslation("signupModal");
  return {
    walletAddress: t("wallet_address"),
    email: t("email"),
    send: t("send"),
    verify: t("verify"),
    verificationCode: t("verification_code"),
    password: t("password"),
    passwordPlaceholder: t("password_placeholder"),
    confirmPassword: t("confirm_password"),
    confirmPasswordPlaceholder: t("confirm_password_placeholder"),
    passwordMismatch: t("password_mismatch"),
    displayName: t("display_name"),
    displayNamePlaceholder: t("display_name_placeholder"),
    userName: t("user_name"),
    usernamePlaceholder: t("username_placeholder"),
    emailPlaceholder: t("email_placeholder"),
    codePlaceholder: t("code_placeholder"),
    agreeTosRequired: t("agree_tos_required"),
    agreeTosText: t("agree_tos_text"),
    agreeNews: t("agree_news"),
    finishSignup: t("finish_signup"),
    loading: t("loading"),
    invalidPasswordFormat: t("invalid_password_format"),
    invalidUsernameFormat: t("invalid_username_format"),
    invalidEmailFormat: t("invalid_email_format"),
    termsRequired: t("terms_required"),
    clickedImage: t("clicked_image"),
    privacyPolicy: t("privacy_policy"),
    termsOfService: t("terms_of_service"),
    childSafety: t("child_safety"),
    failedSendCode: t("failed_send_code"),
    emailAlreadyRegistered: t("email_already_registered"),
    usernameAlreadyExists: t("username_already_exists"),
    failedVerifyCode: t("failed_verify_code"),
  };
}
