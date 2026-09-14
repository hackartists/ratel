import { PointConversionButton } from "./connect-button";
import { fmtCommas } from "./format";
import { useLaunchpadRoundInfo } from "./use-launchpad";

// app/ratel/src/features/launchpad_partner/views/reward_hero.rs (`RewardHero`)
// — the holder's points, the current launchpad round, and (when the round is
// open and there are points) the conversion button bottom-right.

// Rust hardcodes these outside translate! (reward_hero.rs:39, :47, :55, :62,
// :64, :66, :70).
const EYEBROW = "이번 라운드 포인트";
const POINTS_UNIT = "포인트";
const ROUND_LABEL = "라운드";
const ENTRIES_PREFIX = "참여 ";
const REGISTERED_PREFIX = " · 등록 ";
const PTS_SUFFIX = " pts";
const NO_ROUND = "진행 중인 라운드 없음";

export interface RewardHeroProps {
  points: number;
  /** Rust `#[props(default)] show_convert: bool`. */
  showConvert?: boolean;
}

/** Suspends on the round lookup; wrap in `<Suspense fallback={null}>` like the Rust `SuspenseBoundary`. */
export function RewardHero({ points, showConvert = false }: RewardHeroProps) {
  const round = useLaunchpadRoundInfo();

  const isOpen = round.status === "open";
  const canConvert = showConvert && isOpen && points > 0;

  return (
    <div className="hero">
      <div className="hero__main">
        <div className="hero__eyebrow">
          <span className="pulse" />
          <span>{EYEBROW}</span>
          {round.has_round && (
            <>
              <span style={{ color: "var(--text-dim)" }}>·</span>
              <strong>{round.name}</strong>
            </>
          )}
        </div>
        <div className="hero__points">
          <span className="hero__points-value">{fmtCommas(points)}</span>
          <span className="hero__points-unit">{POINTS_UNIT}</span>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <div className="hero__side">
          {round.has_round ? (
            <>
              <div className="hero__token-label">{ROUND_LABEL}</div>
              <div className="hero__token-value">
                <strong>{round.name}</strong>
                <small>{round.status}</small>
              </div>
              <div className="hero__countdown">
                <div className="hero__countdown-text">
                  {ENTRIES_PREFIX}
                  <strong>{fmtCommas(round.total_entries)}</strong>
                  {REGISTERED_PREFIX}
                  <strong>{fmtCommas(round.total_points_registered)}</strong>
                  {PTS_SUFFIX}
                </div>
              </div>
            </>
          ) : (
            <div className="hero__token-label">{NO_ROUND}</div>
          )}
        </div>
        {canConvert && (
          <div className="flex justify-end">
            <PointConversionButton availablePoints={points} />
          </div>
        )}
      </div>
    </div>
  );
}
