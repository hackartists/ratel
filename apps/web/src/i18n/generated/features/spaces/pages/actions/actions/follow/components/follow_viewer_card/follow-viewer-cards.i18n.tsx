// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/spaces/pages/actions/actions/follow/components/follow_viewer_card/follow_viewer_cards.rs (`FollowViewerCardsTranslate`). Namespace "followViewerCards".
import { useTranslation } from "react-i18next";

const en = {
  highlighted_action: "Highlighted Action",
  sub_actions: "Sub Actions",
  highlight_label: "Highlight",
  brief_label: "Brief",
  highlight_copy: "Start with the featured account for this follow action. This view is designed to give the main recommendation enough room to breathe.",
  creator_copy: "This account is currently pinned as the main profile in the action.",
  sub_actions_copy: "Browse the rest of the recommended accounts in a lighter grid layout.",
  no_sub_actions: "No additional profiles yet.",
};

const ko: Record<keyof typeof en, string> = {
  highlighted_action: "Highlighted Action",
  sub_actions: "Sub Actions",
  highlight_label: "Highlight",
  brief_label: "Brief",
  highlight_copy: "이번 팔로우 액션에서 가장 먼저 보여줄 대표 계정입니다. 메인 추천 계정을 충분한 정보와 함께 크게 보여주는 형태입니다.",
  creator_copy: "현재 이 액션에서 대표 프로필로 고정되어 있는 계정입니다.",
  sub_actions_copy: "나머지 추천 계정은 가벼운 그리드 카드 형태로 확인할 수 있습니다.",
  no_sub_actions: "추가 프로필이 아직 없습니다.",
};

export const i18n = { en, ko };

export interface FollowViewerCardsI18n {
  highlightedAction: string;
  subActions: string;
  highlightLabel: string;
  briefLabel: string;
  highlightCopy: string;
  creatorCopy: string;
  subActionsCopy: string;
  noSubActions: string;
}

export function useFollowViewerCardsI18n(): FollowViewerCardsI18n {
  const { t } = useTranslation("followViewerCards");
  return {
    highlightedAction: t("highlighted_action"),
    subActions: t("sub_actions"),
    highlightLabel: t("highlight_label"),
    briefLabel: t("brief_label"),
    highlightCopy: t("highlight_copy"),
    creatorCopy: t("creator_copy"),
    subActionsCopy: t("sub_actions_copy"),
    noSubActions: t("no_sub_actions"),
  };
}
