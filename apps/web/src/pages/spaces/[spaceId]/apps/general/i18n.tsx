// Ported from: app/ratel/src/features/spaces/pages/apps/apps/general/i18n.rs (`GeneralTranslate`). Namespace "general".
import { useTranslation } from "react-i18next";

const en = {
  space_setting: "Space Setting",
  invite_participant: "Invite Participant",
  email_address: "Email Address",
  email_placeholder: "example@example.com",
  default_reward: "Default Reward",
  participant: "Participant",
  can_participate_in_this_space: "Can participate in this space",
  invite: "Invite",
  inviting: "Inviting...",
  participants_invited_successfully: "Participants invited successfully.",
  failed_to_invite_participants: "Failed to invite participants",
  invited_accounts: "Invited Accounts",
  participant_name: "Participant",
  invitation_email: "Email",
  invitation_status: "Status",
  invitation_actions: "Actions",
  invitation_delete: "Delete",
  invitation_deleted_successfully: "Invitation deleted successfully.",
  no_invited_accounts: "No invited accounts yet.",
  loading_invitations: "Loading invitations...",
  administrator: "Administrator",
  administrator_not_found: "Administrator not found",
  failed_to_load_administrator: "Failed to load administrator",
  add_admin: "Add Admin",
  remove_admin: "Remove",
  owner: "Owner",
  admin: "Admin",
  enter_username: "Enter username or email",
  delete_space: "Delete Space",
  deleting: "Deleting...",
  space_deleted_successfully: "Space deleted successfully.",
  failed_to_delete_space: "Failed to delete space",
  no_permission: "No permission",
  anonymous_setting: "Anonymous Participation",
  anonymous_setting_description: "Set participants to join and engage anonymously.",
  anonymous_enabled: "Enabled",
  anonymous_disabled: "Disabled",
  anonymous_updated_successfully: "Anonymous participation setting updated.",
  join_anytime_setting: "Join Anytime",
  join_anytime_description: "Allow participants to join even after the space has started.",
  join_anytime_updated_successfully: "Join anytime setting updated.",
  space_visibility: "Space Visibility",
  space_visibility_description: "Control who can see and access this space",
  public_space: "Public",
  private_space: "Private",
  public_space_desc: "Anyone can see this space",
  private_space_desc: "Only invited members can access",
  visibility_updated_successfully: "Visibility updated successfully.",
  space_logo: "Space Logo",
  space_logo_description: "Customize the logo displayed in the space sidebar.",
  upload_logo: "Upload Logo",
  logo_updated_successfully: "Space logo updated successfully.",
  start_time_setting: "Start Time",
  start_time_description: "Set when this space will start. A countdown will be shown to participants.",
  start_time_updated_successfully: "Start time updated successfully.",
};

const ko: Record<keyof typeof en, string> = {
  space_setting: "스페이스 설정",
  invite_participant: "참가자 초대",
  email_address: "이메일 주소",
  email_placeholder: "example@example.com",
  default_reward: "기본 리워드",
  participant: "참가자",
  can_participate_in_this_space: "이 스페이스에 참여할 수 있습니다",
  invite: "초대",
  inviting: "초대 중...",
  participants_invited_successfully: "참가자 초대를 완료했습니다.",
  failed_to_invite_participants: "참가자 초대에 실패했습니다",
  invited_accounts: "초대된 계정",
  participant_name: "참가자",
  invitation_email: "이메일",
  invitation_status: "상태",
  invitation_actions: "관리",
  invitation_delete: "삭제하기",
  invitation_deleted_successfully: "초대 항목을 삭제했습니다.",
  no_invited_accounts: "아직 초대한 계정이 없습니다.",
  loading_invitations: "초대 목록 불러오는 중...",
  administrator: "관리자",
  administrator_not_found: "관리자를 찾을 수 없습니다",
  failed_to_load_administrator: "관리자 정보를 불러오지 못했습니다",
  add_admin: "관리자 추가",
  remove_admin: "삭제",
  owner: "소유자",
  admin: "관리자",
  enter_username: "사용자명 또는 이메일을 입력하세요",
  delete_space: "스페이스 삭제",
  deleting: "삭제 중...",
  space_deleted_successfully: "스페이스를 삭제했습니다.",
  failed_to_delete_space: "스페이스 삭제에 실패했습니다",
  no_permission: "권한이 없습니다",
  anonymous_setting: "익명 참여",
  anonymous_setting_description: "참가자가 익명으로 참여하고 활동하도록 설정합니다.",
  anonymous_enabled: "활성화",
  anonymous_disabled: "비활성화",
  anonymous_updated_successfully: "익명 참여 설정이 변경되었습니다.",
  join_anytime_setting: "언제든 참여가능",
  join_anytime_description: "스페이스가 시작된 후에도 참가자가 참여할 수 있도록 허용합니다.",
  join_anytime_updated_successfully: "언제든 참여가능 설정이 변경되었습니다.",
  space_visibility: "스페이스 공개 설정",
  space_visibility_description: "이 스페이스에 접근할 수 있는 사용자를 설정합니다",
  public_space: "공개",
  private_space: "비공개",
  public_space_desc: "누구나 이 스페이스를 볼 수 있습니다",
  private_space_desc: "초대된 멤버만 접근할 수 있습니다",
  visibility_updated_successfully: "공개 설정이 변경되었습니다.",
  space_logo: "스페이스 로고",
  space_logo_description: "스페이스 사이드바에 표시되는 로고를 설정합니다.",
  upload_logo: "로고 업로드",
  logo_updated_successfully: "스페이스 로고가 변경되었습니다.",
  start_time_setting: "시작 시간",
  start_time_description: "스페이스 시작 시간을 설정합니다. 참여자에게 카운트다운이 표시됩니다.",
  start_time_updated_successfully: "시작 시간이 변경되었습니다.",
};

export const i18n = { en, ko };

export interface GeneralI18n {
  spaceSetting: string;
  inviteParticipant: string;
  emailAddress: string;
  emailPlaceholder: string;
  defaultReward: string;
  participant: string;
  canParticipateInThisSpace: string;
  invite: string;
  inviting: string;
  participantsInvitedSuccessfully: string;
  failedToInviteParticipants: string;
  invitedAccounts: string;
  participantName: string;
  invitationEmail: string;
  invitationStatus: string;
  invitationActions: string;
  invitationDelete: string;
  invitationDeletedSuccessfully: string;
  noInvitedAccounts: string;
  loadingInvitations: string;
  administrator: string;
  administratorNotFound: string;
  failedToLoadAdministrator: string;
  addAdmin: string;
  removeAdmin: string;
  owner: string;
  admin: string;
  enterUsername: string;
  deleteSpace: string;
  deleting: string;
  spaceDeletedSuccessfully: string;
  failedToDeleteSpace: string;
  noPermission: string;
  anonymousSetting: string;
  anonymousSettingDescription: string;
  anonymousEnabled: string;
  anonymousDisabled: string;
  anonymousUpdatedSuccessfully: string;
  joinAnytimeSetting: string;
  joinAnytimeDescription: string;
  joinAnytimeUpdatedSuccessfully: string;
  spaceVisibility: string;
  spaceVisibilityDescription: string;
  publicSpace: string;
  privateSpace: string;
  publicSpaceDesc: string;
  privateSpaceDesc: string;
  visibilityUpdatedSuccessfully: string;
  spaceLogo: string;
  spaceLogoDescription: string;
  uploadLogo: string;
  logoUpdatedSuccessfully: string;
  startTimeSetting: string;
  startTimeDescription: string;
  startTimeUpdatedSuccessfully: string;
}

export function useGeneralI18n(): GeneralI18n {
  const { t } = useTranslation("general");
  return {
    spaceSetting: t("space_setting"),
    inviteParticipant: t("invite_participant"),
    emailAddress: t("email_address"),
    emailPlaceholder: t("email_placeholder"),
    defaultReward: t("default_reward"),
    participant: t("participant"),
    canParticipateInThisSpace: t("can_participate_in_this_space"),
    invite: t("invite"),
    inviting: t("inviting"),
    participantsInvitedSuccessfully: t("participants_invited_successfully"),
    failedToInviteParticipants: t("failed_to_invite_participants"),
    invitedAccounts: t("invited_accounts"),
    participantName: t("participant_name"),
    invitationEmail: t("invitation_email"),
    invitationStatus: t("invitation_status"),
    invitationActions: t("invitation_actions"),
    invitationDelete: t("invitation_delete"),
    invitationDeletedSuccessfully: t("invitation_deleted_successfully"),
    noInvitedAccounts: t("no_invited_accounts"),
    loadingInvitations: t("loading_invitations"),
    administrator: t("administrator"),
    administratorNotFound: t("administrator_not_found"),
    failedToLoadAdministrator: t("failed_to_load_administrator"),
    addAdmin: t("add_admin"),
    removeAdmin: t("remove_admin"),
    owner: t("owner"),
    admin: t("admin"),
    enterUsername: t("enter_username"),
    deleteSpace: t("delete_space"),
    deleting: t("deleting"),
    spaceDeletedSuccessfully: t("space_deleted_successfully"),
    failedToDeleteSpace: t("failed_to_delete_space"),
    noPermission: t("no_permission"),
    anonymousSetting: t("anonymous_setting"),
    anonymousSettingDescription: t("anonymous_setting_description"),
    anonymousEnabled: t("anonymous_enabled"),
    anonymousDisabled: t("anonymous_disabled"),
    anonymousUpdatedSuccessfully: t("anonymous_updated_successfully"),
    joinAnytimeSetting: t("join_anytime_setting"),
    joinAnytimeDescription: t("join_anytime_description"),
    joinAnytimeUpdatedSuccessfully: t("join_anytime_updated_successfully"),
    spaceVisibility: t("space_visibility"),
    spaceVisibilityDescription: t("space_visibility_description"),
    publicSpace: t("public_space"),
    privateSpace: t("private_space"),
    publicSpaceDesc: t("public_space_desc"),
    privateSpaceDesc: t("private_space_desc"),
    visibilityUpdatedSuccessfully: t("visibility_updated_successfully"),
    spaceLogo: t("space_logo"),
    spaceLogoDescription: t("space_logo_description"),
    uploadLogo: t("upload_logo"),
    logoUpdatedSuccessfully: t("logo_updated_successfully"),
    startTimeSetting: t("start_time_setting"),
    startTimeDescription: t("start_time_description"),
    startTimeUpdatedSuccessfully: t("start_time_updated_successfully"),
  };
}
