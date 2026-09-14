// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/posts/components/create_post_button/mod.rs (`CreatePostButtonTranslate`). Namespace "createPostButton".
import { useTranslation } from "react-i18next";

const en = {
  write: "Create Post",
};

const ko: Record<keyof typeof en, string> = {
  write: "게시물 작성",
};

export const i18n = { en, ko };

export interface CreatePostButtonI18n {
  write: string;
}

export function useCreatePostButtonI18n(): CreatePostButtonI18n {
  const { t } = useTranslation("createPostButton");
  return {
    write: t("write"),
  };
}
