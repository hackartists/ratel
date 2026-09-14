// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/posts/components/visibility_modal/mod.rs (`VisibilityModalTranslate`). Namespace "postsVisibilityModalVisibilityModal".
import { useTranslation } from "react-i18next";

const en = {
  title: "Post Visibility",
  description: "Choose who can see this post",
  public_label: "Public",
  public_desc: "Anyone can see this post",
  private_label: "Private",
  private_desc: "Only you can see this post",
  cancel: "Cancel",
  confirm: "Publish",
};

const ko: Record<keyof typeof en, string> = {
  title: "게시물 공개 범위",
  description: "이 게시물을 볼 수 있는 사람을 선택하세요",
  public_label: "공개",
  public_desc: "누구나 이 게시물을 볼 수 있습니다",
  private_label: "비공개",
  private_desc: "나만 이 게시물을 볼 수 있습니다",
  cancel: "취소",
  confirm: "게시",
};

export const i18n = { en, ko };

export interface PostsVisibilityModalVisibilityModalI18n {
  title: string;
  description: string;
  publicLabel: string;
  publicDesc: string;
  privateLabel: string;
  privateDesc: string;
  cancel: string;
  confirm: string;
}

export function usePostsVisibilityModalVisibilityModalI18n(): PostsVisibilityModalVisibilityModalI18n {
  const { t } = useTranslation("postsVisibilityModalVisibilityModal");
  return {
    title: t("title"),
    description: t("description"),
    publicLabel: t("public_label"),
    publicDesc: t("public_desc"),
    privateLabel: t("private_label"),
    privateDesc: t("private_desc"),
    cancel: t("cancel"),
    confirm: t("confirm"),
  };
}
