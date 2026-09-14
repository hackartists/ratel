import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { findTeamHandler, getTeamMembershipHandler } from "@ratel/ts-bridges";
import type { SpaceActionStatus } from "@ratel/ts-bridges";
import { useUpdateSpaceAction } from "@ratel/ts-bridges/hooks";
import { Switch } from "@/components/ui/switch";
import { useArenaRewardI18n } from "@/i18n/generated/features/spaces/pages/actions/components/action_reward_setting/arena-reward.i18n";
import { useAuth, useUserMembership } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { isActionLocked } from "./access";
import { useSpace } from "@/components/space/space-context";

// app/ratel/src/features/spaces/pages/actions/components/action_reward_setting —
// Reward + Boost card: resolves the paying membership (team for team spaces,
// the signed-in user otherwise), tracks credits and persists through
// `update_space_action` (`Credits`).

/** `UserType::Team` (serde_repr). */
const USER_TYPE_TEAM = 2;

export interface ActionRewardSettingProps {
  spaceId: string;
  actionId: string;
  savedCredits: number;
  actionStatus: SpaceActionStatus | null;
  onChange?: (credits: number) => void;
}

function formatNumber(n: number): string {
  const s = String(Math.trunc(n));
  let result = "";
  for (let i = 0; i < s.length; i += 1) {
    if (i > 0 && (s.length - i) % 3 === 0) result += ",";
    result += s[i];
  }
  return result;
}

export function ActionRewardSetting({ spaceId, actionId, savedCredits, actionStatus, onChange }: ActionRewardSettingProps) {
  const tr = useArenaRewardI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const auth = useAuth();
  const update = useUpdateSpaceAction();
  const [currentCredits, setCurrentCredits] = useState(savedCredits);
  const [enableReward, setEnableReward] = useState(savedCredits > 0);

  const space = useSpace();
  const rewardLocked = isActionLocked(space.status, actionStatus);
  const isTeamSpace = space.author_type === USER_TYPE_TEAM;

  // Spaces owned by a regular user have no matching team — a failed lookup
  // resolves to `null` instead of failing the whole editor.
  const team = useSuspenseQuery({
    queryKey: ["actionRewardTeam", isTeamSpace ? space.author_username : null],
    queryFn: () => (isTeamSpace ? findTeamHandler(space.author_username).catch(() => null) : Promise.resolve(null)),
  }).data;
  const teamUsername = team?.username ?? "";
  const teamMembership = useSuspenseQuery({
    queryKey: ["actionRewardTeamMembership", isTeamSpace ? teamUsername : null],
    queryFn: () =>
      isTeamSpace && teamUsername !== ""
        ? getTeamMembershipHandler(teamUsername).catch(() => null)
        : Promise.resolve(null),
  }).data;
  const userMembership = useUserMembership();

  const membershipUsername = isTeamSpace
    ? (team?.username ?? space.author_username)
    : (auth.userContext.user?.username ?? "");

  const basePaid = isTeamSpace
    ? teamMembership !== null && !teamMembership.tier.includes("Free")
    : userMembership !== null && !userMembership.tier.includes("Free");
  const baseMaxCredits = Math.max(
    0,
    (isTeamSpace ? teamMembership?.max_credits_per_space : userMembership?.max_credits_per_space) ?? 0,
  );
  const baseRemainingCredits = Math.max(
    0,
    (isTeamSpace ? teamMembership?.remaining_credits : userMembership?.remaining_credits) ?? 0,
  );

  const [remainingCredits, setRemainingCredits] = useState(baseRemainingCredits);
  // Non-team spaces follow the signed-in user's membership credits.
  const authRemaining = auth.userContext.membership ? Math.max(0, auth.userContext.membership.remaining_credits) : 0;
  useEffect(() => {
    if (!isTeamSpace) setRemainingCredits(authRemaining);
  }, [isTeamSpace, authRemaining]);

  const availableCredits = remainingCredits + currentCredits;
  const boostMultiplier = Math.max(currentCredits, 1);
  const totalReward = boostMultiplier * 10_000;

  // The async save reads the latest credits the way the Rust closure reads signals.
  const creditsRef = useRef(currentCredits);
  creditsRef.current = currentCredits;
  const remainingRef = useRef(remainingCredits);
  remainingRef.current = remainingCredits;

  const saveCredits = (nextCredits: number) => {
    const previous = creditsRef.current;
    update
      .mutateAsync({ spaceId, actionId, req: { credits: nextCredits } })
      .then(() => {
        const delta = nextCredits - previous;
        setCurrentCredits(nextCredits);
        creditsRef.current = nextCredits;
        const nextRemaining = Math.max(0, remainingRef.current - Math.max(delta, 0)) + Math.max(-delta, 0);
        setRemainingCredits(nextRemaining);
        remainingRef.current = nextRemaining;
        if (!isTeamSpace) {
          const ctx = auth.userContext;
          if (ctx.membership) {
            auth.setUserContext({
              ...ctx,
              membership: { ...ctx.membership, remaining_credits: Math.max(0, ctx.membership.remaining_credits - delta) },
            });
          }
        }
        toast.info(tr.rewardUpdated);
        onChange?.(nextCredits);
      })
      .catch((e) => toast.error(e));
  };

  // The number input shows what was typed until the saved value changes.
  const [creditsDraft, setCreditsDraft] = useState(String(currentCredits));
  useEffect(() => setCreditsDraft(String(currentCredits)), [currentCredits]);

  return (
    <div className="arena-reward">
      <div className="arena-reward__head">
        <div className="arena-reward__head-title">
          <span className="arena-reward__head-title-text">{tr.reward}</span>
          <span className="arena-reward__head-info">
            <InfoCircleSvg />
          </span>
        </div>
        {basePaid && availableCredits > 0 ? (
          // Shared `Switch` (same as PrerequisiteTile); the wrapper keeps the testid.
          <div data-testid="reward-setting-toggle">
            <Switch
              active={enableReward}
              disabled={rewardLocked}
              label={tr.reward}
              onToggle={() => {
                if (rewardLocked) {
                  toast.info(tr.lockedStarted);
                  return;
                }
                const next = !enableReward;
                setEnableReward(next);
                saveCredits(next ? 1 : 0);
              }}
            />
          </div>
        ) : (
          <button
            className="arena-reward__unlock"
            type="button"
            onClick={() => navigate(`/${membershipUsername}/memberships`)}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            {tr.unlock}
          </button>
        )}
      </div>

      {enableReward && (
        <>
          <div className="arena-reward__grid">
            <div className="arena-reward__column">
              <span className="arena-reward__column-label">{tr.defaultReward}</span>
              <div className="arena-reward__display">
                <div className="arena-reward__boost-badge">
                  <div className="arena-reward__boost-icon">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </div>
                  <span className="arena-reward__boost-mult">
                    {`x${boostMultiplier} ${tr.boostLabel}`}
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12h14" />
                      <path d="M12 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
                <div className="arena-reward__display-body">
                  <span className="arena-reward__display-value">{formatNumber(totalReward)}</span>
                  <span className="arena-reward__display-label">{tr.actionPointReward}</span>
                </div>
              </div>
            </div>

            <div className="arena-reward__column">
              <span className="arena-reward__column-label">{tr.boostMultiplier}</span>
              <div className="arena-reward__boost-tile">
                <div className="arena-reward__boost-row">
                  <span className="arena-reward__boost-row-label">{tr.creditUsage}</span>
                  <input
                    className="arena-reward__credit-input"
                    type="number"
                    min="0"
                    data-testid="reward-credit-input"
                    readOnly={rewardLocked}
                    disabled={rewardLocked}
                    value={creditsDraft}
                    onChange={(e) => {
                      if (rewardLocked) return;
                      setCreditsDraft(e.target.value);
                      const parsed = /^\d+$/.test(e.target.value) ? Number(e.target.value) : 0;
                      const limit =
                        baseMaxCredits > 0
                          ? Math.min(parsed, baseMaxCredits, availableCredits)
                          : Math.min(parsed, availableCredits);
                      saveCredits(limit);
                    }}
                  />
                </div>
                {baseMaxCredits > 0 && (
                  <div className="arena-reward__boost-row">
                    <span className="arena-reward__boost-row-label">{tr.maxCredits}</span>
                    <span className="arena-reward__boost-row-value">{formatNumber(baseMaxCredits)}</span>
                  </div>
                )}
                <div className="arena-reward__boost-row">
                  <span className="arena-reward__boost-row-label">{tr.remainingCredits}</span>
                  <span className="arena-reward__boost-row-value arena-reward__boost-row-value--green">
                    {formatNumber(remainingCredits)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="arena-reward__info">
            <div className="arena-reward__info-icon">
              <InfoCircleSvg />
            </div>
            <div className="arena-reward__info-body">
              <span className="arena-reward__info-title">{tr.pointBoost}</span>
              <ul className="arena-reward__info-list">
                <li>{tr.pointBoostLineOne}</li>
                <li>{tr.pointBoostLineTwo}</li>
                <li>{tr.pointBoostLineThree}</li>
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function InfoCircleSvg() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}
