// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/spaces/space_common/components/space_nav/participation_requirements_layover.rs (`ParticipationRequirementsLayoverTranslate`). Namespace "participationRequirementsLayover".
import { useTranslation } from "react-i18next";

const en = {
  join_space: "Join Space",
};

const ko: Record<keyof typeof en, string> = {
  join_space: "스페이스 참여",
};

export const i18n = { en, ko };

export interface ParticipationRequirementsLayoverI18n {
  joinSpace: string;
}

export function useParticipationRequirementsLayoverI18n(): ParticipationRequirementsLayoverI18n {
  const { t } = useTranslation("participationRequirementsLayover");
  return {
    joinSpace: t("join_space"),
  };
}
