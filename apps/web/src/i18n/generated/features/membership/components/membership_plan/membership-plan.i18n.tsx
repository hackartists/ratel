// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/membership/components/membership_plan/i18n.rs (`MembershipPlanTranslate`). Namespace "membershipPlan".
import { useTranslation } from "react-i18next";

const en = {
  title: "Membership Plans",
  description: "<strong class=\"font-bold text-primary\">Credits</strong> are monthly points you can use to create or boost <span class=\"text-primary\">Reward Spaces</span>.",
};

const ko: Record<keyof typeof en, string> = {
  title: "멤버십 플랜",
  description: "<strong class=\"font-bold text-primary\">Credits</strong>은 <span class=\"text-primary\">보상 스페이스</span>를 생성하거나 부스팅시키는 데 사용할 수 있는 월간 포인트입니다.",
};

export const i18n = { en, ko };

export interface MembershipPlanI18n {
  title: string;
  description: string;
}

export function useMembershipPlanI18n(): MembershipPlanI18n {
  const { t } = useTranslation("membershipPlan");
  return {
    title: t("title"),
    description: t("description"),
  };
}
