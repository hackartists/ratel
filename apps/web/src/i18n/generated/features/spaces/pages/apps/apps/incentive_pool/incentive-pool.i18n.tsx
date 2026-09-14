// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/spaces/pages/apps/apps/incentive_pool/i18n.rs (`IncentivePoolTranslate`). Namespace "incentivePool".
import { useTranslation } from "react-i18next";

const en = {
  page_title: "Incentive Pool",
  header_title: "Incentive Pool",
  header_description: "This reward pool runs on the Kaia mainnet and is funded by depositing USDT into the deployed reward contract. Rewards are distributed to eligible participants based on verified engagement and accumulated score. Higher scores increase reward probability, but distribution follows the predefined allocation rules.",
  section_incentive_pool: "Incentive Pool",
  incentive_pool_address: "Incentive Pool Address",
  total_winners: "Total Winners",
  rank_rate: "Rank Rate",
  people: "People",
  total_deposit_amount: "Total Deposit Amount",
  deposit_in_incentive_pool: "Deposit in Incentive Pool",
  incentive_token: "Incentive Token",
  select: "Select",
  token_distribution_hint: "Token used for incentives distribution",
  deposit_amount: "Deposit Amount",
  deposit_amount_hint: "It sends tokens to the generated incentive pool address.",
  distribution: "Distribution",
  weight_sampling: "Weight Sampling",
  top_10_rank_only: "Top 10 Rank Only",
  rank_100: "Rank 100%",
  high_score_random: "High Score Random",
  ranking_lottery: "Ranking Lottery",
  mix: "Mix",
  rank_70_random_30: "Rank 70% : Random 30%",
  mainnet_and_funding: "Mainnet & funding",
  network_support_note: "· Kaia / ICP networks supported. Funding is external token send only.",
  external_funding_note: "· Ratel does not pull funds automatically, you send tokens to the generated treasury address.",
  confirm_setup: "Confirm Setup",
  registering: "Registering...",
  address_copied: "Address copied.",
  invalid_usdt_amount: "Please enter a numeric USDT amount.",
  incentive_pool_registered: "Incentive pool registered.",
  load_incentive_failed: "Failed to load incentive pool data.",
  copy_address_failed: "Failed to copy address.",
  refresh_tokens_failed: "Failed to refresh token balances.",
  register_incentive_failed: "Failed to register incentive pool.",
  loading: "Loading...",
  no_permission: "No permission",
};

const ko: Record<keyof typeof en, string> = {
  page_title: "인센티브 풀",
  header_title: "인센티브 풀",
  header_description: "이 리워드 풀은 Kaia 메인넷에서 동작하며, 배포된 리워드 컨트랙트에 USDT를 입금해 운용됩니다. 리워드는 검증된 참여 활동과 누적 점수에 따라 자격을 갖춘 참가자에게 분배됩니다. 점수가 높을수록 보상 확률이 올라가지만, 분배는 사전에 정의된 규칙을 따릅니다.",
  section_incentive_pool: "인센티브 풀",
  incentive_pool_address: "인센티브 풀 주소",
  total_winners: "총 당첨자",
  rank_rate: "랭크 비율",
  people: "명",
  total_deposit_amount: "총 예치 금액",
  deposit_in_incentive_pool: "인센티브 풀 입금",
  incentive_token: "인센티브 토큰",
  select: "선택",
  token_distribution_hint: "인센티브 분배에 사용할 토큰",
  deposit_amount: "입금 수량",
  deposit_amount_hint: "생성된 인센티브 풀 주소로 토큰을 전송합니다.",
  distribution: "분배 방식",
  weight_sampling: "가중치 샘플링",
  top_10_rank_only: "상위 10명 랭크만",
  rank_100: "랭크 100%",
  high_score_random: "고득점 랜덤",
  ranking_lottery: "랭킹 추첨",
  mix: "혼합",
  rank_70_random_30: "랭크 70% : 랜덤 30%",
  mainnet_and_funding: "메인넷 및 자금 조달",
  network_support_note: "· Kaia / ICP 네트워크를 지원합니다. 자금 조달은 외부 토큰 전송 방식만 지원합니다.",
  external_funding_note: "· Ratel이 자금을 자동으로 가져오지 않으며, 생성된 트레저리 주소로 직접 토큰을 보내야 합니다.",
  confirm_setup: "설정 확정",
  registering: "등록 중...",
  address_copied: "주소를 복사했습니다.",
  invalid_usdt_amount: "USDT 수량은 숫자 형식으로 입력해주세요.",
  incentive_pool_registered: "인센티브 풀이 등록되었습니다.",
  load_incentive_failed: "인센티브 풀 데이터를 불러오지 못했습니다.",
  copy_address_failed: "주소 복사에 실패했습니다.",
  refresh_tokens_failed: "토큰 잔액 새로고침에 실패했습니다.",
  register_incentive_failed: "인센티브 풀 등록에 실패했습니다.",
  loading: "로딩 중...",
  no_permission: "권한이 없습니다",
};

export const i18n = { en, ko };

export interface IncentivePoolI18n {
  pageTitle: string;
  headerTitle: string;
  headerDescription: string;
  sectionIncentivePool: string;
  incentivePoolAddress: string;
  totalWinners: string;
  rankRate: string;
  people: string;
  totalDepositAmount: string;
  depositInIncentivePool: string;
  incentiveToken: string;
  select: string;
  tokenDistributionHint: string;
  depositAmount: string;
  depositAmountHint: string;
  distribution: string;
  weightSampling: string;
  top10RankOnly: string;
  rank100: string;
  highScoreRandom: string;
  rankingLottery: string;
  mix: string;
  rank70Random30: string;
  mainnetAndFunding: string;
  networkSupportNote: string;
  externalFundingNote: string;
  confirmSetup: string;
  registering: string;
  addressCopied: string;
  invalidUsdtAmount: string;
  incentivePoolRegistered: string;
  loadIncentiveFailed: string;
  copyAddressFailed: string;
  refreshTokensFailed: string;
  registerIncentiveFailed: string;
  loading: string;
  noPermission: string;
}

export function useIncentivePoolI18n(): IncentivePoolI18n {
  const { t } = useTranslation("incentivePool");
  return {
    pageTitle: t("page_title"),
    headerTitle: t("header_title"),
    headerDescription: t("header_description"),
    sectionIncentivePool: t("section_incentive_pool"),
    incentivePoolAddress: t("incentive_pool_address"),
    totalWinners: t("total_winners"),
    rankRate: t("rank_rate"),
    people: t("people"),
    totalDepositAmount: t("total_deposit_amount"),
    depositInIncentivePool: t("deposit_in_incentive_pool"),
    incentiveToken: t("incentive_token"),
    select: t("select"),
    tokenDistributionHint: t("token_distribution_hint"),
    depositAmount: t("deposit_amount"),
    depositAmountHint: t("deposit_amount_hint"),
    distribution: t("distribution"),
    weightSampling: t("weight_sampling"),
    top10RankOnly: t("top_10_rank_only"),
    rank100: t("rank_100"),
    highScoreRandom: t("high_score_random"),
    rankingLottery: t("ranking_lottery"),
    mix: t("mix"),
    rank70Random30: t("rank_70_random_30"),
    mainnetAndFunding: t("mainnet_and_funding"),
    networkSupportNote: t("network_support_note"),
    externalFundingNote: t("external_funding_note"),
    confirmSetup: t("confirm_setup"),
    registering: t("registering"),
    addressCopied: t("address_copied"),
    invalidUsdtAmount: t("invalid_usdt_amount"),
    incentivePoolRegistered: t("incentive_pool_registered"),
    loadIncentiveFailed: t("load_incentive_failed"),
    copyAddressFailed: t("copy_address_failed"),
    refreshTokensFailed: t("refresh_tokens_failed"),
    registerIncentiveFailed: t("register_incentive_failed"),
    loading: t("loading"),
    noPermission: t("no_permission"),
  };
}
