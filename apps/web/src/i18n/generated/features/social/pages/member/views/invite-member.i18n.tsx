// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/social/pages/member/views/i18n.rs (`InviteMemberTranslate`). Namespace "inviteMember".
import { useTranslation } from "react-i18next";

const en = {
  select_group: "Select the group",
  group_admin: "Admin",
  group_member: "Member",
  email_label: "Email, Username, or Phone Number",
  email_hint: "Enter email, username, or phone number (ex: john@example.com or john or 01012345678)",
  send: "Send",
  searching: "Searching...",
  user_not_found: "User not found",
  failed_invite: "Failed to invite members",
  already_added: "is already added",
};

const ko: Record<keyof typeof en, string> = {
  select_group: "그룹 선택",
  group_admin: "관리자",
  group_member: "멤버",
  email_label: "이메일, 이름, 또는 핸드폰 번호",
  email_hint: "이메일, 이름 또는 핸드폰 번호를 입력해주세요. (ex: john@example.com or john or 01012345678)",
  send: "전송",
  searching: "검색 중...",
  user_not_found: "사용자를 찾을 수 없습니다",
  failed_invite: "멤버 초대에 실패했습니다",
  already_added: "이(가) 이미 추가되었습니다",
};

export const i18n = { en, ko };

export interface InviteMemberI18n {
  selectGroup: string;
  groupAdmin: string;
  groupMember: string;
  emailLabel: string;
  emailHint: string;
  send: string;
  searching: string;
  userNotFound: string;
  failedInvite: string;
  alreadyAdded: string;
}

export function useInviteMemberI18n(): InviteMemberI18n {
  const { t } = useTranslation("inviteMember");
  return {
    selectGroup: t("select_group"),
    groupAdmin: t("group_admin"),
    groupMember: t("group_member"),
    emailLabel: t("email_label"),
    emailHint: t("email_hint"),
    send: t("send"),
    searching: t("searching"),
    userNotFound: t("user_not_found"),
    failedInvite: t("failed_invite"),
    alreadyAdded: t("already_added"),
  };
}
