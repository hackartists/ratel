// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/spaces/pages/actions/actions/follow/views/main/viewer/i18n.rs (`FollowViewerTranslate`). Namespace "followViewer".
import { useTranslation } from "react-i18next";

const en = {
  btn_back: "Back",
};

const ko: Record<keyof typeof en, string> = {
  btn_back: "뒤로",
};

export const i18n = { en, ko };

export interface FollowViewerI18n {
  btnBack: string;
}

export function useFollowViewerI18n(): FollowViewerI18n {
  const { t } = useTranslation("followViewer");
  return {
    btnBack: t("btn_back"),
  };
}
