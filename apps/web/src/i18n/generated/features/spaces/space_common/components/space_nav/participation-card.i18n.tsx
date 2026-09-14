// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/spaces/space_common/components/space_nav/participation_card.rs (`ParticipationCardTranslate`). Namespace "participationCard".
import { useTranslation } from "react-i18next";

const en = {
  title: "Participation",
  description: "You can read everything, but posting, voting and commenting require verification.",
  participate: "Participate",
};

const ko: Record<keyof typeof en, string> = {
  title: "참여",
  description: "모든 내용을 읽을 수 있지만, 게시, 투표, 댓글은 검증이 필요합니다.",
  participate: "참여하기",
};

export const i18n = { en, ko };

export interface ParticipationCardI18n {
  title: string;
  description: string;
  participate: string;
}

export function useParticipationCardI18n(): ParticipationCardI18n {
  const { t } = useTranslation("participationCard");
  return {
    title: t("title"),
    description: t("description"),
    participate: t("participate"),
  };
}
