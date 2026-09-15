// Ported from: app/ratel/src/common/components/premium_switch/mod.rs (`PremiumUnlockTranslate`). Namespace "premiumUnlock".
import { useTranslation } from "react-i18next";

const en = {
  unlock: "Unlock",
};

const ko: Record<keyof typeof en, string> = {
  unlock: "잠금 해제",
};

export const i18n = { en, ko };

export interface PremiumUnlockI18n {
  unlock: string;
}

export function usePremiumUnlockI18n(): PremiumUnlockI18n {
  const { t } = useTranslation("premiumUnlock");
  return {
    unlock: t("unlock"),
  };
}
