// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/admin/layout.rs (`AdminLayoutTranslate`). Namespace "adminLayout".
import { useTranslation } from "react-i18next";

const en = {
  brand_name: "Admin",
};

const ko: Record<keyof typeof en, string> = {
  brand_name: "관리자",
};

export const i18n = { en, ko };

export interface AdminLayoutI18n {
  brandName: string;
}

export function useAdminLayoutI18n(): AdminLayoutI18n {
  const { t } = useTranslation("adminLayout");
  return {
    brandName: t("brand_name"),
  };
}
