import { ExpandPage, Repost } from "@/components/icons/arrows";
import { Clipboard } from "@/components/icons/notes-clipboard";
import { Chest } from "@/components/icons/ratel";
import { ShieldLock } from "@/components/icons/security";
import { Extra } from "@/components/icons/validations";
import { Button, ButtonStyle } from "@/components/ui/button";
import { useIncentivePoolI18n } from "@/i18n/generated/features/spaces/pages/apps/apps/incentive_pool/incentive-pool.i18n";
import { useSpaceAppsContext } from "@/layouts/space-apps-layout";
import { DistributionModeCard, IconActionButton, SectionCard, SummaryStatCard } from "./components/cards";
import { formatTokenBalance, usdtTokens } from "./hooks/format";
import { DEFAULT_RECIPIENT_COUNT, useIncentivePool } from "./hooks/use-incentive-pool";

// app/ratel/src/features/spaces/pages/apps/apps/incentive_pool/views/home/mod.rs
// (`SpaceIncentivePoolAppPage`, `/spaces/:spaceId/apps/incentive-pool`): the pool
// address (open in explorer / copy / refresh balances), winners and deposit
// totals, the USDT token and deposit amount, the distribution mode, and
// "Confirm Setup" which deploys and registers the pool.

const HEADING = "font-bold font-raleway text-[24px]/[28px] tracking-[-0.24px] text-web-font-primary";
const LABEL = "font-bold leading-5 font-raleway text-[17px] tracking-[-0.18px] text-web-font-primary";

export function Component() {
  const tr = useIncentivePoolI18n();
  const { spaceId } = useSpaceAppsContext();
  const pool = useIncentivePool(spaceId);

  const tokenItems = usdtTokens(pool.tokens);
  const totalDepositAmount = tokenItems[0] ? formatTokenBalance(tokenItems[0].balance, tokenItems[0].decimals) : "0";
  const showIncentiveAddress = pool.isLoading && pool.incentiveAddress === "" ? tr.loading : pool.incentiveAddress;
  const confirmLabel = pool.isRegistering ? tr.registering : tr.confirmSetup;
  const addressEmpty = pool.incentiveAddress.trim() === "";

  return (
    <div className="flex overflow-visible flex-col gap-5 self-start pb-6 w-full min-w-0 shrink-0 max-w-[1024px] max-tablet:gap-4 text-web-font-primary">
      <h3 className={HEADING}>{tr.pageTitle}</h3>

      {pool.notice !== null && (
        <p className="py-3 px-4 text-sm border rounded-[8px] border-separator bg-card text-card-meta">{pool.notice}</p>
      )}

      <div className="p-4 w-full rounded-[12px] bg-card max-mobile:p-3">
        <div className="flex gap-3 justify-between items-start">
          <div className="flex flex-col items-start min-w-0 gap-[10px]">
            <div className="flex justify-center items-center w-11 h-11 bg-violet-500 rounded-[10px]">
              <Chest width="24" height="24" className="text-web-font-primary [&>path]:fill-none [&>path]:stroke-current" />
            </div>
            <p className={LABEL}>{tr.headerTitle}</p>
            <p className="w-full font-medium leading-4 font-raleway text-[12px] tracking-[0] text-card-meta">
              {tr.headerDescription}
            </p>
          </div>

          {/* Rust renders this overflow button without a handler. */}
          <button className="flex justify-center items-center w-6 h-6 text-web-font-neutral">
            <Extra width="20" height="20" className="[&>circle]:fill-current" />
          </button>
        </div>
      </div>

      <SectionCard title={tr.sectionIncentivePool} titleClass={HEADING} bodyClass="flex flex-col gap-4 p-5 bg-card max-mobile:p-4">
        <div className="flex flex-col gap-2 items-start">
          <p className={LABEL}>{tr.incentivePoolAddress}</p>
          <div className="flex gap-2 items-center w-full max-tablet:flex-wrap">
            <div className="flex flex-1 items-center w-full min-w-0 h-11 border-gray-600 rounded-[8px] border-[0.5px] bg-web-input">
              <input
                className="flex-1 px-3 min-w-0 h-full font-medium bg-transparent outline-none font-raleway text-[15px] leading-[18px] tracking-[-0.16px] text-web-font-primary"
                value={showIncentiveAddress}
                readOnly
              />
              <button
                className="flex justify-center items-center w-11 h-full disabled:opacity-50 shrink-0 rounded-r-[8px] text-web-font-neutral"
                disabled={addressEmpty}
                onClick={pool.openExplorer}
              >
                <ExpandPage width="20" height="20" className="[&>path]:stroke-current" />
              </button>
            </div>

            <IconActionButton disabled={addressEmpty} onClick={pool.copyAddress}>
              <Clipboard width="24" height="24" className="[&>path]:stroke-current" />
            </IconActionButton>

            <IconActionButton disabled={pool.isRefreshing || pool.incentive === null} onClick={pool.refresh}>
              <Repost width="24" height="24" className="[&>path]:stroke-current" />
            </IconActionButton>
          </div>
        </div>

        <div className="grid grid-cols-2 w-full gap-[10px] max-tablet:grid-cols-1">
          <SummaryStatCard title={tr.totalWinners} badge={tr.rankRate} value={String(DEFAULT_RECIPIENT_COUNT)} unit={tr.people} />
          <SummaryStatCard title={tr.totalDepositAmount} badge={null} value={totalDepositAmount} unit="USDT" />
        </div>
      </SectionCard>

      <SectionCard
        title={tr.depositInIncentivePool}
        titleClass={HEADING}
        bodyClass="flex flex-col items-start p-5 gap-[10px] bg-card max-mobile:p-4"
      >
        <div className="flex flex-col gap-2 justify-center items-start w-full">
          <p className={LABEL}>{tr.incentiveToken}</p>
          <select
            className="flex justify-between items-center px-3 w-full h-11 font-medium border-gray-600 rounded-[8px] border-[0.5px] bg-web-input font-raleway text-[15px] leading-[18px] tracking-[-0.16px] text-web-font-primary disabled:text-web-font-neutral"
            disabled={tokenItems.length === 0}
            value={pool.selectedToken ?? ""}
            onChange={(e) => pool.setSelectedToken(e.currentTarget.value === "" ? null : e.currentTarget.value)}
          >
            {tokenItems.length === 0 ? (
              <option value="">{tr.select}</option>
            ) : (
              tokenItems.map((token) => (
                <option key={token.token_address} value={token.token_address}>
                  {token.symbol}
                </option>
              ))
            )}
          </select>
          <p className="font-normal text-gray-500 font-inter text-[12px] leading-[16px]">{tr.tokenDistributionHint}</p>
        </div>

        <div className="flex flex-col gap-2 justify-center items-start w-full">
          <p className={LABEL}>{tr.depositAmount}</p>
          <div className="relative w-full">
            <input
              className="px-3 w-full h-12 font-medium text-right border-gray-600 rounded-[8px] border-[0.5px] bg-web-input pr-[68px] font-raleway text-[15px] leading-[18px] tracking-[-0.16px] text-web-font-primary"
              value={pool.depositInput}
              onChange={(e) => pool.changeDeposit(e.currentTarget.value)}
            />
            <span className="absolute right-3 top-1/2 font-normal text-gray-500 -translate-y-1/2 pointer-events-none font-inter text-[12px] leading-[16px]">
              USDT
            </span>
          </div>
          {pool.depositValidation !== null ? (
            <p className="font-normal text-red-400 font-inter text-[12px] leading-[16px]">{pool.depositValidation}</p>
          ) : (
            <p className="font-normal text-gray-500 font-inter text-[12px] leading-[16px]">{tr.depositAmountHint}</p>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title={tr.distribution}
        titleClass="font-semibold leading-5 text-center font-raleway text-[17px] tracking-[-0.18px] text-web-font-primary"
        bodyClass="flex flex-col items-start p-5 gap-[10px] bg-card max-mobile:p-4"
      >
        <div className="flex flex-col gap-2 items-start w-full">
          <p className="font-semibold font-raleway text-[15px] leading-[18px] tracking-[-0.16px] text-web-font-primary">
            {tr.weightSampling}
          </p>

          <div className="grid grid-cols-3 gap-2 w-full max-tablet:grid-cols-1">
            <DistributionModeCard
              selected={pool.distributionMode === "Top10RankOnly"}
              title={tr.top10RankOnly}
              description={tr.rank100}
              onClick={() => pool.setDistributionMode("Top10RankOnly")}
            />
            <DistributionModeCard
              selected={pool.distributionMode === "HighScoreRandom"}
              title={tr.highScoreRandom}
              description={tr.rankingLottery}
              onClick={() => pool.setDistributionMode("HighScoreRandom")}
            />
            <DistributionModeCard
              selected={pool.distributionMode === "Mix"}
              title={tr.mix}
              description={tr.rank70Random30}
              onClick={() => pool.setDistributionMode("Mix")}
            />
          </div>
        </div>

        <div className="flex gap-5 items-start p-5 w-full border border-gray-600 h-[102px] rounded-[12px] bg-neutral-800 max-tablet:h-auto">
          <ShieldLock width="18" height="18" className="mt-0.5 shrink-0 text-card-meta [&>path]:stroke-current" />

          <div className="flex flex-col flex-1 gap-0.5 items-start min-w-0">
            <p className="w-full font-semibold leading-5 font-raleway text-[17px] tracking-[-0.18px] text-web-font-primary">
              {tr.mainnetAndFunding}
            </p>
            <p className="w-full font-medium leading-5 font-raleway text-[13px] tracking-[0] text-card-meta">
              {tr.networkSupportNote}
            </p>
            <p className="w-full font-medium leading-5 font-raleway text-[13px] tracking-[0] text-card-meta">
              {tr.externalFundingNote}
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-3 w-full max-tablet:justify-stretch">
          <Button
            className="inline-flex justify-center items-center self-stretch border w-[146px] max-tablet:w-full"
            buttonStyle={ButtonStyle.Secondary}
            onClick={pool.register}
          >
            {confirmLabel}
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
