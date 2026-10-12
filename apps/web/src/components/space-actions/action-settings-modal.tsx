import { useRef, useState } from "react";
import type { SpaceActionSummary } from "@ratel/ts-bridges";
import { ExpandPage, LineArrowLeft } from "@/components/icons/arrows";
import { Thunder } from "@/components/icons/game";
import { Info } from "@/components/icons/help-support";
import { Clock } from "@/components/icons/ratel";
import { Gift } from "@/components/icons/shopping";
import { Add, Clear } from "@/components/icons/validations";
import { Button, ButtonShape, ButtonSize, ButtonStyle } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useEnumI18n } from "@/i18n/enums.i18n";
import { useActionSettingsModalI18n } from "./action-settings-modal.i18n";
import { useLayover } from "@/lib/layover";
import { useToast } from "@/lib/toast";
import { useDismissOnOutsideClick } from "@/lib/use-dismiss-on-outside-click";
import { formatWithCommas } from "./action-card";

// app/ratel/src/features/spaces/pages/actions/components/action_settings_modal.

interface RewardPreviewData {
  totalReward: number;
  credits: number;
  points: number;
}

function supportsActionSettings(action: SpaceActionSummary): boolean {
  return action.action_type !== "Follow" && action.action_type !== "Announcement";
}

function selectedActionsOf(actions: SpaceActionSummary[], selectedIds: string[]): SpaceActionSummary[] {
  return selectedIds
    .map((id) => actions.find((action) => supportsActionSettings(action) && action.action_id === id))
    .filter((action): action is SpaceActionSummary => action !== undefined);
}

function availableActionsOf(actions: SpaceActionSummary[], selectedIds: string[]): SpaceActionSummary[] {
  return actions.filter((action) => supportsActionSettings(action) && !selectedIds.includes(action.action_id));
}

function rewardPreviewItems(actions: SpaceActionSummary[]): RewardPreviewData[] {
  if (actions.length === 0) return [];
  // The Rust utils return these placeholder preview values until the
  // action-settings rewards API exists (utils.rs `reward_preview_items`).
  return [{ totalReward: 100_000, credits: 10, points: 10_000 }];
}

/** utils.rs `reward_credit_summary` — placeholder values in the Rust source as well. */
function rewardCreditSummary(): [number, number] {
  return [2, 50];
}

function formatCreditAmount(value: number, singular: string, plural: string): string {
  return `${formatWithCommas(value)} ${Math.abs(value) === 1 ? singular : plural}`;
}

export interface ActionSettingsModalProps {
  spaceId: string;
  actions: SpaceActionSummary[];
  onApplied: () => void;
}

export function ActionSettingsModal({ actions, onApplied }: ActionSettingsModalProps) {
  const tr = useActionSettingsModalI18n();
  const enumT = useEnumI18n();
  const layover = useLayover();
  const toast = useToast();

  const [selectedActionIds, setSelectedActionIds] = useState<string[]>(() =>
    actions.filter(supportsActionSettings).map((action) => action.action_id),
  );
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  // Press anywhere outside the picker closes it.
  useDismissOnOutsideClick(addMenuRef, isAddMenuOpen, setIsAddMenuOpen);
  const [isRewardsEnabled, setIsRewardsEnabled] = useState(false);
  const isApplying = false;

  const selectedActions = selectedActionsOf(actions, selectedActionIds);
  const availableActions = availableActionsOf(actions, selectedActionIds);
  const rewardPreviews = rewardPreviewItems(selectedActions);
  const [creditUsage, remainingCredits] = rewardCreditSummary();

  const actionLabel = (action: SpaceActionSummary) => {
    const title = action.title.trim() === "" ? tr.untitled : action.title.trim();
    return `${enumT("SpaceActionType", action.action_type)}: ${title}`;
  };

  return (
    <div className="flex justify-end w-full h-full text-web-font-primary">
      <div className="flex overflow-y-auto flex-col gap-5 py-6 px-6 w-full h-full shrink-0 bg-background max-tablet:px-5 max-tablet:py-5 max-mobile:min-h-full max-mobile:gap-4 max-mobile:px-4 max-mobile:py-4">
        <div className="flex gap-3 items-center max-mobile:gap-2.5">
          <Button
            size={ButtonSize.Icon}
            buttonStyle={ButtonStyle.Text}
            shape={ButtonShape.Square}
            className="flex justify-center items-center p-0 rounded-none hover:bg-transparent size-5 text-web-font-primary"
            onClick={() => layover.close()}
          >
            <LineArrowLeft width="20" height="20" className="[&>path]:stroke-current" />
          </Button>

          <h4 className="font-bold font-raleway text-[15px]/[20px] tracking-[0.5px] text-web-font-primary max-mobile:text-[14px]/[18px]">
            {tr.title}
          </h4>
        </div>

        <div className="flex flex-col gap-2.5">
          {selectedActions.map((action) => (
            <ActionSettingsActionChip
              key={action.action_id}
              label={actionLabel(action)}
              onRemove={() => {
                setSelectedActionIds((ids) => ids.filter((id) => id !== action.action_id));
                setIsAddMenuOpen(false);
              }}
            />
          ))}
        </div>

        <div className="relative w-full" id="action-add-menu" ref={addMenuRef}>
          <Button
            size={ButtonSize.Medium}
            buttonStyle={ButtonStyle.Text}
            shape={ButtonShape.Square}
            className={
              availableActions.length === 0
                ? "flex h-11 w-full items-center gap-2.5 rounded-[10px] bg-button-muted py-2.5 pr-5 pl-2.5 text-left hover:bg-button-muted cursor-not-allowed opacity-50"
                : "flex h-11 w-full items-center gap-2.5 rounded-[10px] bg-button-muted py-2.5 pr-5 pl-2.5 text-left hover:bg-button-muted"
            }
            disabled={availableActions.length === 0}
            onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
          >
            <Add width="20" height="20" className="text-web-font-neutral [&>path]:stroke-current" />
            <span className="min-w-0 font-bold truncate font-raleway text-[15px]/[18px] tracking-[-0.16px] text-web-font-neutral">
              {availableActions.length === 0 ? tr.noAvailableActions : tr.selectAction}
            </span>
          </Button>

          {isAddMenuOpen && availableActions.length > 0 && (
            <div className="flex overflow-hidden overflow-y-auto absolute left-0 top-full z-10 flex-col mt-2 w-full border border-primary rounded-[10px] bg-popover shadow-[0_8px_20px_0_rgba(20,26,62,0.25)] max-mobile:max-h-56">
              {availableActions.map((action) => (
                <Button
                  key={action.action_id}
                  size={ButtonSize.Medium}
                  buttonStyle={ButtonStyle.Text}
                  shape={ButtonShape.Square}
                  className="flex justify-start items-start py-2.5 px-3 w-full font-medium text-left whitespace-normal break-words rounded-none min-h-11 font-raleway text-[15px]/[18px] text-web-font-primary hover:bg-button-muted-hover"
                  onClick={() => {
                    setSelectedActionIds((ids) => [...ids, action.action_id]);
                    setIsAddMenuOpen(false);
                  }}
                >
                  {actionLabel(action)}
                </Button>
              ))}
            </div>
          )}
        </div>

        <div className="w-full border-t border-separator" />

        <div className="flex flex-col gap-4 py-1">
          <div className="flex gap-3 justify-between items-center">
            <div className="flex gap-2.5 items-center text-web-font-primary">
              <Gift
                width="20"
                height="20"
                className="[&>path]:stroke-current [&>path]:fill-none [&>rect]:stroke-current [&>rect]:fill-none"
              />
              <span className="font-bold font-raleway text-[17px]/[20px] tracking-[-0.18px] max-mobile:text-[15px]/[18px]">
                {tr.rewards}
              </span>
            </div>

            <Switch active={isRewardsEnabled} onToggle={() => setIsRewardsEnabled(!isRewardsEnabled)} />
          </div>

          {isRewardsEnabled && (
            <div className="flex flex-col gap-5 max-mobile:gap-4">
              {rewardPreviews.length === 0 ? (
                <Card className="w-full font-medium rounded-[8px] border-web-card-stroke bg-web-card-bg px-[17px] py-[17px] font-raleway text-[13px]/[20px] text-web-font-neutral max-mobile:px-4 max-mobile:py-4">
                  {tr.noRewardsConfigured}
                </Card>
              ) : (
                rewardPreviews.map((reward, idx) => (
                  <RewardSummaryCard
                    key={`reward-preview-${idx}`}
                    reward={reward}
                    actionPointReward={tr.actionPointReward}
                    boostUnit={tr.boostUnit}
                  />
                ))
              )}

              <Card className="flex gap-3 justify-between items-center w-full text-left rounded-[8px] border-web-card-stroke bg-web-card-bg px-[17px] py-[17px] max-mobile:px-4 max-mobile:py-4">
                <span className="flex-1 font-bold font-raleway text-[15px]/[18px] tracking-[-0.16px] text-web-font-neutral">
                  {tr.boostMultiplierSettings}
                </span>
                <ExpandPage width="20" height="20" className="shrink-0 text-web-font-neutral [&>path]:stroke-current" />
              </Card>

              <RewardsCreditsCard
                creditUsage={creditUsage}
                remainingCredits={remainingCredits}
                creditUsageLabel={tr.creditUsage}
                remainingCreditsLabel={tr.remainingCredits}
                creditUnitSingular={tr.creditUnitSingular}
                creditUnitPlural={tr.creditUnitPlural}
              />

              <RewardsInfoCard
                title={tr.pointBoost}
                lineOne={tr.pointBoostLineOne}
                lineTwo={tr.pointBoostLineTwo}
                lineThree={tr.pointBoostLineThree}
                membership={tr.membership}
              />
            </div>
          )}
        </div>

        <div className="pt-2 mt-auto">
          <Button
            size={ButtonSize.Medium}
            buttonStyle={ButtonStyle.Primary}
            shape={ButtonShape.Square}
            className="flex justify-center w-full rounded-[10px] font-raleway text-[15px]/[18px] tracking-[-0.16px]"
            disabled={selectedActions.length === 0 || isApplying}
            onClick={() => {
              toast.info(tr.appliedSuccess);
              onApplied();
              layover.close();
            }}
          >
            {isApplying ? tr.applying : tr.apply}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ActionSettingsActionChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <div className="flex min-h-11 w-full items-start justify-between gap-2.5 rounded-[10px] bg-button-muted p-2.5">
      <div className="flex min-w-0 items-start gap-2.5">
        <Thunder
          width="18"
          height="18"
          className="shrink-0 text-web-font-primary [&>path]:stroke-current [&>path]:fill-none"
        />
        <span className="whitespace-normal break-words font-bold font-raleway text-[14px]/[16px] text-web-font-primary">
          {label}
        </span>
      </div>

      <Button
        size={ButtonSize.Icon}
        buttonStyle={ButtonStyle.Text}
        shape={ButtonShape.Square}
        className="flex size-[18px] shrink-0 items-center justify-center rounded-none p-0 text-web-font-neutral hover:bg-transparent"
        onClick={() => onRemove()}
      >
        <Clear width="18" height="18" className="[&>path]:stroke-current" />
      </Button>
    </div>
  );
}

function RewardSummaryCard({
  reward,
  actionPointReward,
  boostUnit,
}: {
  reward: RewardPreviewData;
  actionPointReward: string;
  boostUnit: string;
}) {
  return (
    <Card className="flex w-full min-h-[136px] flex-col gap-2 rounded-[8px] border-web-card-stroke bg-web-card-bg px-[17px] py-[17px] max-mobile:px-4 max-mobile:py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-[10px] bg-green-500 text-web-font-ab-bk">
          <Clock width="24" height="24" className="[&>circle]:fill-none" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col items-end gap-1 text-right">
          <p className="w-full font-bold font-inter text-[24px]/[24px] text-web-font-primary">
            {formatWithCommas(reward.totalReward)}
          </p>
          <p className="w-full font-semibold font-raleway text-[15px]/[18px] tracking-[-0.16px] text-web-font-neutral">
            {actionPointReward}
          </p>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <span className="font-medium font-inter text-[12px]/[16px] text-web-font-primary">{`${reward.credits} ${boostUnit}`}</span>
          <Clear width="18" height="18" className="text-web-font-neutral [&>path]:stroke-current" />
        </div>

        <span className="font-semibold font-inter text-[12px]/[16px] text-web-font-primary">
          {formatWithCommas(reward.points)}
        </span>
      </div>
    </Card>
  );
}

function RewardsCreditsCard({
  creditUsage,
  remainingCredits,
  creditUsageLabel,
  remainingCreditsLabel,
  creditUnitSingular,
  creditUnitPlural,
}: {
  creditUsage: number;
  remainingCredits: number;
  creditUsageLabel: string;
  remainingCreditsLabel: string;
  creditUnitSingular: string;
  creditUnitPlural: string;
}) {
  return (
    <Card className="flex h-[84px] w-full flex-col gap-2 rounded-[8px] border-web-card-stroke bg-web-card-bg px-[17px] pt-[17px] pb-1 max-mobile:h-auto max-mobile:px-4 max-mobile:pt-4 max-mobile:pb-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold font-raleway text-[13px]/[16px] tracking-[-0.14px] text-web-font-neutral">
          {creditUsageLabel}
        </p>
        <p className="font-semibold font-raleway text-[15px]/[18px] tracking-[-0.16px] text-web-font-primary">
          {formatCreditAmount(creditUsage, creditUnitSingular, creditUnitPlural)}
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold font-raleway text-[13px]/[16px] tracking-[-0.14px] text-web-font-neutral">
          {remainingCreditsLabel}
        </p>
        <p className="font-semibold font-raleway text-[15px]/[18px] tracking-[-0.16px] text-green-500">
          {formatCreditAmount(remainingCredits, creditUnitSingular, creditUnitPlural)}
        </p>
      </div>
    </Card>
  );
}

function RewardsInfoCard({
  title,
  lineOne,
  lineTwo,
  lineThree,
  membership,
}: {
  title: string;
  lineOne: string;
  lineTwo: string;
  lineThree: string;
  membership: string;
}) {
  return (
    <div className="flex w-full items-start gap-5 rounded-[12px] border border-web-card-stroke3 bg-web-card-bg2 p-5 max-mobile:gap-4 max-mobile:p-4">
      <Info width="18" height="18" className="mt-0.5 shrink-0 text-web-font-neutral [&>path]:stroke-current" />

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="font-semibold font-raleway text-[15px]/[18px] tracking-[-0.16px] text-web-font-primary">{title}</p>

        <div className="flex flex-col text-[13px]/[20px] font-medium font-raleway text-web-font-body">
          <p>{`• ${lineOne}`}</p>
          <p>{`• ${lineTwo}`}</p>
          <p>
            {`• ${lineThree} `}
            <span className="underline">{membership}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
