// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/character/pages/character_page/i18n.rs (`CharacterPageTranslate`). Namespace "characterPage".
import { useTranslation } from "react-i18next";

const en = {
  page_title: "Character",
  level_label: "Level",
  xp_title: "Character XP",
  xp_to_next: "XP to Level",
  xp_total_earned: "Total XP earned",
  sp_label: "Skill Points",
  sp_hint_ready: "points ready to spend",
  sp_hint_one_ready: "1 point ready to spend",
  sp_hint_empty: "Earn XP to grant more",
  sp_hint_default: "Spend on the tree below",
  skill_tree_title: "Skill Tree",
  skill_tree_hint: "+5% per level · Max +50% at L10",
  money_tree_name: "Money Tree",
  money_tree_sub: "RatelPoint earning boost",
  money_tree_desc: "Boosts every RatelPoint payout you receive from any space's reward, applied multiplicatively before the amount is credited to your balance.",
  ranker_name: "Ranker",
  ranker_sub: "SpaceXP & Character XP boost",
  ranker_desc: "Boosts the bonus portion of every SpaceActivity you record. Compounds: more XP per action → faster character leveling → more SP for future skills.",
  influencer_name: "Influencer",
  influencer_sub: "Lower Hot threshold for your spaces",
  influencer_desc: "Lowers the participants-required-for-Hot threshold for spaces you own — at L6 your space surfaces with just 4 participants instead of the global 10.",
  sweeper_name: "Sweeper",
  sweeper_sub: "Higher owner bonus on your spaces",
  sweeper_desc: "When a participant claims a reward in a space you own, the owner-bonus you receive goes up by +5% per level. At L6 you take 40% of every payout instead of the default 10%.",
  levelup_label: "Level Up",
  maxed_label: "Maxed",
  locked_label: "Locked",
  coming_soon: "v2 · Coming soon",
  not_released: "Not yet released",
  next_boost: "Next: +",
  next_was: "% (was +",
  max_reached: "Maximum boost reached",
  level_meta_label: "Level",
  status_meta_label: "Status",
  sp_unit: "SP",
};

const ko: Record<keyof typeof en, string> = {
  page_title: "캐릭터",
  level_label: "레벨",
  xp_title: "캐릭터 XP",
  xp_to_next: "다음 레벨까지",
  xp_total_earned: "누적 XP",
  sp_label: "스킬 포인트",
  sp_hint_ready: "사용 가능 포인트",
  sp_hint_one_ready: "1 포인트 사용 가능",
  sp_hint_empty: "XP를 모아 포인트를 획득하세요",
  sp_hint_default: "아래 스킬 트리에서 사용하세요",
  skill_tree_title: "스킬 트리",
  skill_tree_hint: "레벨당 +5% · L10에서 최대 +50%",
  money_tree_name: "머니트리",
  money_tree_sub: "RatelPoint 획득 부스트",
  money_tree_desc: "모든 스페이스 보상에서 받는 RatelPoint 지급액에 곱셈 부스트를 적용하여, 잔액에 적립되기 전에 가산됩니다.",
  ranker_name: "랭커",
  ranker_sub: "스페이스XP 및 캐릭터 XP 부스트",
  ranker_desc: "모든 스페이스 활동에서 적립되는 보너스 XP를 부스트합니다. 복리 효과: 활동당 더 많은 XP → 더 빠른 레벨업 → 더 많은 SP.",
  influencer_name: "인플루언서",
  influencer_sub: "내 스페이스의 핫 노출 기준 완화",
  influencer_desc: "내가 소유한 스페이스가 핫에 노출되는 데 필요한 참여자 수를 완화합니다. L6에서는 기본 10명 대신 4명만 있으면 노출됩니다.",
  sweeper_name: "싹쓸이",
  sweeper_sub: "내 스페이스 소유자 보너스 증가",
  sweeper_desc: "내가 소유한 스페이스에서 참여자가 보상을 청구할 때, 소유자 보너스가 레벨당 +5%씩 증가합니다. L6에서는 기본 10% 대신 40%를 받습니다.",
  levelup_label: "레벨 업",
  maxed_label: "최대치",
  locked_label: "잠김",
  coming_soon: "v2 · 곧 출시",
  not_released: "아직 출시되지 않음",
  next_boost: "다음: +",
  next_was: "% (현재 +",
  max_reached: "최대 부스트 도달",
  level_meta_label: "레벨",
  status_meta_label: "상태",
  sp_unit: "SP",
};

export const i18n = { en, ko };

export interface CharacterPageI18n {
  pageTitle: string;
  levelLabel: string;
  xpTitle: string;
  xpToNext: string;
  xpTotalEarned: string;
  spLabel: string;
  spHintReady: string;
  spHintOneReady: string;
  spHintEmpty: string;
  spHintDefault: string;
  skillTreeTitle: string;
  skillTreeHint: string;
  moneyTreeName: string;
  moneyTreeSub: string;
  moneyTreeDesc: string;
  rankerName: string;
  rankerSub: string;
  rankerDesc: string;
  influencerName: string;
  influencerSub: string;
  influencerDesc: string;
  sweeperName: string;
  sweeperSub: string;
  sweeperDesc: string;
  levelupLabel: string;
  maxedLabel: string;
  lockedLabel: string;
  comingSoon: string;
  notReleased: string;
  nextBoost: string;
  nextWas: string;
  maxReached: string;
  levelMetaLabel: string;
  statusMetaLabel: string;
  spUnit: string;
}

export function useCharacterPageI18n(): CharacterPageI18n {
  const { t } = useTranslation("characterPage");
  return {
    pageTitle: t("page_title"),
    levelLabel: t("level_label"),
    xpTitle: t("xp_title"),
    xpToNext: t("xp_to_next"),
    xpTotalEarned: t("xp_total_earned"),
    spLabel: t("sp_label"),
    spHintReady: t("sp_hint_ready"),
    spHintOneReady: t("sp_hint_one_ready"),
    spHintEmpty: t("sp_hint_empty"),
    spHintDefault: t("sp_hint_default"),
    skillTreeTitle: t("skill_tree_title"),
    skillTreeHint: t("skill_tree_hint"),
    moneyTreeName: t("money_tree_name"),
    moneyTreeSub: t("money_tree_sub"),
    moneyTreeDesc: t("money_tree_desc"),
    rankerName: t("ranker_name"),
    rankerSub: t("ranker_sub"),
    rankerDesc: t("ranker_desc"),
    influencerName: t("influencer_name"),
    influencerSub: t("influencer_sub"),
    influencerDesc: t("influencer_desc"),
    sweeperName: t("sweeper_name"),
    sweeperSub: t("sweeper_sub"),
    sweeperDesc: t("sweeper_desc"),
    levelupLabel: t("levelup_label"),
    maxedLabel: t("maxed_label"),
    lockedLabel: t("locked_label"),
    comingSoon: t("coming_soon"),
    notReleased: t("not_released"),
    nextBoost: t("next_boost"),
    nextWas: t("next_was"),
    maxReached: t("max_reached"),
    levelMetaLabel: t("level_meta_label"),
    statusMetaLabel: t("status_meta_label"),
    spUnit: t("sp_unit"),
  };
}
