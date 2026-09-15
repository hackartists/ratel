// Ported from: app/ratel/src/features/spaces/pages/apps/apps/general/views/home/delete_space_popup.rs (`DeleteSpacePopupTranslate`). Namespace "deleteSpacePopup".
import { useTranslation } from "react-i18next";

const en = {
  title: "Delete Space?",
  confirm_pre: "This will permanently delete ",
  confirm_post: ", including all actions, comments, and governance data. This action cannot be undone.",
  cancel: "Cancel",
  confirm: "Delete",
};

const ko: Record<keyof typeof en, string> = {
  title: "스페이스를 삭제하시겠습니까?",
  confirm_pre: "다음 스페이스가 영구적으로 삭제됩니다: ",
  confirm_post: ". 모든 액션, 댓글, 거버넌스 데이터까지 함께 사라지며 되돌릴 수 없습니다.",
  cancel: "취소",
  confirm: "삭제",
};

export const i18n = { en, ko };

export interface DeleteSpacePopupI18n {
  title: string;
  confirmPre: string;
  confirmPost: string;
  cancel: string;
  confirm: string;
}

export function useDeleteSpacePopupI18n(): DeleteSpacePopupI18n {
  const { t } = useTranslation("deleteSpacePopup");
  return {
    title: t("title"),
    confirmPre: t("confirm_pre"),
    confirmPost: t("confirm_post"),
    cancel: t("cancel"),
    confirm: t("confirm"),
  };
}
