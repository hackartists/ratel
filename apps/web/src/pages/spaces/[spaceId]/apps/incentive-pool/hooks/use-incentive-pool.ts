import type { SpaceIncentive, SpaceIncentiveToken } from "@ratel/ts-bridges";
import { useEffect, useRef, useState } from "react";
import { useIncentivePoolI18n } from "@/i18n/generated/features/spaces/pages/apps/apps/incentive_pool/incentive-pool.i18n";
import { defaultUsdtTokenAddress, incentiveExplorerUrl, isValidUsdtInput } from "./format";
import { loadIncentiveAndTokens, refreshTokens, registerIncentivePool } from "./incentive-pool-api";

// State and handlers of app/ratel/src/features/spaces/pages/apps/apps/incentive_pool/views/home/mod.rs
// (`SpaceIncentivePoolAppPage`): load once, refresh balances, copy / open the
// pool address, validate the deposit amount, register the pool. Outcomes are
// shown as the page's inline notice, like the Rust signals.

export const DEFAULT_RECIPIENT_COUNT = 10;
const MIX_RANKING_BPS = 7000;

export type DistributionMode = "Top10RankOnly" | "HighScoreRandom" | "Mix";

const CONTRACT_MODE: Record<DistributionMode, number> = { HighScoreRandom: 0, Top10RankOnly: 1, Mix: 2 };

export function useIncentivePool(spaceId: string) {
  const tr = useIncentivePoolI18n();

  const [distributionMode, setDistributionMode] = useState<DistributionMode>("Top10RankOnly");
  const [incentive, setIncentive] = useState<SpaceIncentive | null>(null);
  const [tokens, setTokens] = useState<SpaceIncentiveToken[]>([]);
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  /** Last valid amount (Rust `deposit_amount`). */
  const [depositAmount, setDepositAmount] = useState("");
  /** What the field shows — Dioxus leaves rejected keystrokes in the DOM. */
  const [depositInput, setDepositInput] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [depositValidation, setDepositValidation] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const trRef = useRef(tr);
  trRef.current = tr;
  const didLoad = useRef(false);

  useEffect(() => {
    if (didLoad.current) return;
    didLoad.current = true;
    setIsLoading(true);
    loadIncentiveAndTokens(spaceId)
      .then(([loadedIncentive, loadedTokens]) => {
        setIncentive(loadedIncentive);
        setSelectedToken(defaultUsdtTokenAddress(loadedTokens));
        setTokens(loadedTokens);
      })
      .catch((err: unknown) => {
        console.error("Failed to load incentive pool data:", err);
        setNotice(trRef.current.loadIncentiveFailed);
      })
      .finally(() => setIsLoading(false));
  }, [spaceId]);

  const incentiveAddress = incentive?.contract_address ?? "";

  const openExplorer = () => {
    const url = incentiveExplorerUrl(incentiveAddress);
    if (url !== null) window.open(url);
  };

  const copyAddress = () => {
    if (incentiveAddress.trim() === "") return;
    navigator.clipboard.writeText(incentiveAddress).then(
      () => setNotice(tr.addressCopied),
      (err: unknown) => {
        console.error("Failed to copy address:", err);
        setNotice(tr.copyAddressFailed);
      },
    );
  };

  const refresh = () => {
    if (isRefreshing || incentive === null) return;
    setIsRefreshing(true);
    setNotice(null);
    refreshTokens(spaceId)
      .then((loadedTokens) => {
        setSelectedToken(defaultUsdtTokenAddress(loadedTokens));
        setTokens(loadedTokens);
      })
      .catch((err: unknown) => {
        console.error("Failed to refresh incentive tokens:", err);
        setNotice(tr.refreshTokensFailed);
      })
      .finally(() => setIsRefreshing(false));
  };

  const changeDeposit = (value: string) => {
    setDepositInput(value);
    if (isValidUsdtInput(value)) {
      setDepositValidation(null);
      setDepositAmount(value);
    } else {
      setDepositValidation(tr.invalidUsdtAmount);
    }
  };

  const register = () => {
    if (isRegistering || isLoading) return;
    if (!isValidUsdtInput(depositAmount)) {
      setDepositValidation(tr.invalidUsdtAmount);
      return;
    }
    setIsRegistering(true);
    setNotice(null);
    registerIncentivePool(
      spaceId,
      CONTRACT_MODE[distributionMode],
      distributionMode === "Mix" ? MIX_RANKING_BPS : 0,
      DEFAULT_RECIPIENT_COUNT,
    )
      .then(([created, loadedTokens]) => {
        setSelectedToken(defaultUsdtTokenAddress(loadedTokens));
        setIncentive(created);
        setTokens(loadedTokens);
        setNotice(tr.incentivePoolRegistered);
      })
      .catch((err: unknown) => {
        console.error("Failed to register incentive pool:", err);
        setNotice(tr.registerIncentiveFailed);
      })
      .finally(() => setIsRegistering(false));
  };

  return {
    distributionMode,
    setDistributionMode,
    incentive,
    incentiveAddress,
    tokens,
    selectedToken,
    setSelectedToken,
    depositInput,
    changeDeposit,
    notice,
    depositValidation,
    isLoading,
    isRegistering,
    isRefreshing,
    openExplorer,
    copyAddress,
    refresh,
    register,
  };
}
