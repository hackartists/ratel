// Ported from: app/ratel/src/common/components/team_creation_form/team_creation_form.rs (`TeamCreationFormTranslate`). Namespace "teamCreationForm".
import { useTranslation } from "react-i18next";

const en = {
  team_display_name: "Team Name",
  team_id: "Team ID",
  team_description: "Team description",
  upload_logo: "Upload logo",
  cancel: "Cancel",
  create: "Create",
  username_too_short: "Team ID must be at least 3 characters",
  username_invalid_chars: "Only lowercase letters, digits, and underscores allowed",
};

const ko: Record<keyof typeof en, string> = {
  team_display_name: "팀 이름",
  team_id: "팀 ID",
  team_description: "팀 설명을 입력해주세요.",
  upload_logo: "로고 업로드",
  cancel: "취소",
  create: "생성",
  username_too_short: "팀 ID는 3자 이상이어야 합니다",
  username_invalid_chars: "소문자, 숫자, 밑줄만 사용할 수 있습니다",
};

export const i18n = { en, ko };

export interface TeamCreationFormI18n {
  teamDisplayName: string;
  teamId: string;
  teamDescription: string;
  uploadLogo: string;
  cancel: string;
  create: string;
  usernameTooShort: string;
  usernameInvalidChars: string;
}

export function useTeamCreationFormI18n(): TeamCreationFormI18n {
  const { t } = useTranslation("teamCreationForm");
  return {
    teamDisplayName: t("team_display_name"),
    teamId: t("team_id"),
    teamDescription: t("team_description"),
    uploadLogo: t("upload_logo"),
    cancel: t("cancel"),
    create: t("create"),
    usernameTooShort: t("username_too_short"),
    usernameInvalidChars: t("username_invalid_chars"),
  };
}
