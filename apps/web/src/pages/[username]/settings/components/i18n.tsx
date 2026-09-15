// Ported from: app/ratel/src/features/social/pages/setting/user/views/mod.rs (`UserSettingsTranslate`). Namespace "userSettings".
import { useTranslation } from "react-i18next";

const en = {
  settings: "Settings",
  profile: "Profile",
  username: "Username",
  email: "Email",
  display_name: "Display Name",
  description: "Description",
  display_name_placeholder: "Display name",
  description_placeholder: "Tell us about yourself",
  save: "Save",
  saving: "Saving...",
  upload: "Upload",
  profile_updated: "Profile updated successfully.",
  invalid_words: "Invalid words detected.",
  password: "Password",
  current_password: "Current Password",
  new_password: "New Password",
  confirm_password: "Confirm Password",
  current_password_placeholder: "Enter current password",
  new_password_placeholder: "Min 8 characters",
  confirm_password_placeholder: "Confirm new password",
  change_password: "Change Password",
  changing_password: "Changing...",
  password_changed: "Password changed successfully.",
  all_fields_required: "All fields are required.",
  password_min_length: "Password must be at least 8 characters.",
  passwords_not_match: "Passwords do not match.",
  subscription_billing: "Subscription & Billing",
  current_plan: "Current Plan",
  credits: "Credits",
  expires: "Expires",
  unlimited: "Unlimited",
  change_plan: "Change Plan",
  enterprise: "Enterprise",
  card: "Card",
  card_holder: "Card Holder",
  change_card: "Change Card",
  add_card: "Add Card",
  cancel: "Cancel",
  card_number: "Card Number",
  expiry_month: "Expiry Month",
  expiry_year: "Expiry Year",
  birth_date: "Birth Date (YYMMDD)",
  card_password_label: "Card Password (first 2 digits)",
  save_card: "Save Card",
  saving_card: "Saving...",
  card_updated: "Card updated successfully.",
  login_required: "Please log in to access settings.",
  mcp_server: "MCP Server",
  mcp_description: "Connect your Ratel account to AI assistants like Claude Desktop using the Model Context Protocol.",
  mcp_server_url: "Server URL",
  mcp_generate: "Generate Secret",
  mcp_regenerate: "Regenerate",
  mcp_generating: "Generating...",
  mcp_copied: "Copied to clipboard!",
  mcp_copy: "Copy",
  mcp_not_generated: "No secret generated yet. Click Generate to create one.",
  mcp_secret_exists: "A secret has been generated. Click Regenerate to get a new URL. The token is only shown once after generation.",
};

const ko: Record<keyof typeof en, string> = {
  settings: "설정",
  profile: "프로필",
  username: "사용자명",
  email: "이메일",
  display_name: "닉네임",
  description: "소개",
  display_name_placeholder: "닉네임을 입력하세요",
  description_placeholder: "자기소개를 입력하세요",
  save: "저장",
  saving: "저장 중...",
  upload: "업로드",
  profile_updated: "프로필이 업데이트되었습니다.",
  invalid_words: "허용되지 않는 단어가 감지되었습니다.",
  password: "비밀번호",
  current_password: "현재 비밀번호",
  new_password: "새 비밀번호",
  confirm_password: "비밀번호 확인",
  current_password_placeholder: "현재 비밀번호를 입력하세요",
  new_password_placeholder: "최소 8자 이상",
  confirm_password_placeholder: "새 비밀번호 확인",
  change_password: "비밀번호 변경",
  changing_password: "변경 중...",
  password_changed: "비밀번호가 변경되었습니다.",
  all_fields_required: "모든 항목을 입력해주세요.",
  password_min_length: "비밀번호는 최소 8자 이상이어야 합니다.",
  passwords_not_match: "비밀번호가 일치하지 않습니다.",
  subscription_billing: "구독 및 결제",
  current_plan: "현재 플랜",
  credits: "크레딧",
  expires: "만료일",
  unlimited: "무제한",
  change_plan: "플랜 변경",
  enterprise: "엔터프라이즈",
  card: "카드",
  card_holder: "카드 소유자",
  change_card: "카드 변경",
  add_card: "카드 추가",
  cancel: "취소",
  card_number: "카드 번호",
  expiry_month: "만료 월",
  expiry_year: "만료 연도",
  birth_date: "생년월일 (YYMMDD)",
  card_password_label: "카드 비밀번호 (앞 2자리)",
  save_card: "카드 저장",
  saving_card: "저장 중...",
  card_updated: "카드가 업데이트되었습니다.",
  login_required: "설정에 접근하려면 로그인해주세요.",
  mcp_server: "MCP 서버",
  mcp_description: "Model Context Protocol을 사용하여 Claude Desktop과 같은 AI 어시스턴트에 Ratel 계정을 연결하세요.",
  mcp_server_url: "서버 URL",
  mcp_generate: "시크릿 생성",
  mcp_regenerate: "재생성",
  mcp_generating: "생성 중...",
  mcp_copied: "클립보드에 복사되었습니다!",
  mcp_copy: "복사",
  mcp_not_generated: "아직 시크릿이 생성되지 않았습니다. 생성 버튼을 클릭하세요.",
  mcp_secret_exists: "시크릿이 생성되어 있습니다. 재생성 버튼을 클릭하면 새 URL을 받을 수 있습니다. 토큰은 생성 직후에만 표시됩니다.",
};

export const i18n = { en, ko };

export interface UserSettingsI18n {
  settings: string;
  profile: string;
  username: string;
  email: string;
  displayName: string;
  description: string;
  displayNamePlaceholder: string;
  descriptionPlaceholder: string;
  save: string;
  saving: string;
  upload: string;
  profileUpdated: string;
  invalidWords: string;
  password: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  currentPasswordPlaceholder: string;
  newPasswordPlaceholder: string;
  confirmPasswordPlaceholder: string;
  changePassword: string;
  changingPassword: string;
  passwordChanged: string;
  allFieldsRequired: string;
  passwordMinLength: string;
  passwordsNotMatch: string;
  subscriptionBilling: string;
  currentPlan: string;
  credits: string;
  expires: string;
  unlimited: string;
  changePlan: string;
  enterprise: string;
  card: string;
  cardHolder: string;
  changeCard: string;
  addCard: string;
  cancel: string;
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  birthDate: string;
  cardPasswordLabel: string;
  saveCard: string;
  savingCard: string;
  cardUpdated: string;
  loginRequired: string;
  mcpServer: string;
  mcpDescription: string;
  mcpServerUrl: string;
  mcpGenerate: string;
  mcpRegenerate: string;
  mcpGenerating: string;
  mcpCopied: string;
  mcpCopy: string;
  mcpNotGenerated: string;
  mcpSecretExists: string;
}

export function useUserSettingsI18n(): UserSettingsI18n {
  const { t } = useTranslation("userSettings");
  return {
    settings: t("settings"),
    profile: t("profile"),
    username: t("username"),
    email: t("email"),
    displayName: t("display_name"),
    description: t("description"),
    displayNamePlaceholder: t("display_name_placeholder"),
    descriptionPlaceholder: t("description_placeholder"),
    save: t("save"),
    saving: t("saving"),
    upload: t("upload"),
    profileUpdated: t("profile_updated"),
    invalidWords: t("invalid_words"),
    password: t("password"),
    currentPassword: t("current_password"),
    newPassword: t("new_password"),
    confirmPassword: t("confirm_password"),
    currentPasswordPlaceholder: t("current_password_placeholder"),
    newPasswordPlaceholder: t("new_password_placeholder"),
    confirmPasswordPlaceholder: t("confirm_password_placeholder"),
    changePassword: t("change_password"),
    changingPassword: t("changing_password"),
    passwordChanged: t("password_changed"),
    allFieldsRequired: t("all_fields_required"),
    passwordMinLength: t("password_min_length"),
    passwordsNotMatch: t("passwords_not_match"),
    subscriptionBilling: t("subscription_billing"),
    currentPlan: t("current_plan"),
    credits: t("credits"),
    expires: t("expires"),
    unlimited: t("unlimited"),
    changePlan: t("change_plan"),
    enterprise: t("enterprise"),
    card: t("card"),
    cardHolder: t("card_holder"),
    changeCard: t("change_card"),
    addCard: t("add_card"),
    cancel: t("cancel"),
    cardNumber: t("card_number"),
    expiryMonth: t("expiry_month"),
    expiryYear: t("expiry_year"),
    birthDate: t("birth_date"),
    cardPasswordLabel: t("card_password_label"),
    saveCard: t("save_card"),
    savingCard: t("saving_card"),
    cardUpdated: t("card_updated"),
    loginRequired: t("login_required"),
    mcpServer: t("mcp_server"),
    mcpDescription: t("mcp_description"),
    mcpServerUrl: t("mcp_server_url"),
    mcpGenerate: t("mcp_generate"),
    mcpRegenerate: t("mcp_regenerate"),
    mcpGenerating: t("mcp_generating"),
    mcpCopied: t("mcp_copied"),
    mcpCopy: t("mcp_copy"),
    mcpNotGenerated: t("mcp_not_generated"),
    mcpSecretExists: t("mcp_secret_exists"),
  };
}
