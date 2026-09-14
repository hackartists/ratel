import * as React from "react";
import type { SpaceActionSummary } from "@ratel/ts-bridges";
import { useSpace } from "@/components/space/space-context";
import { useEnumI18n } from "@/i18n/generated/enums.i18n";
import { useSpaceViewerI18n } from "@/i18n/generated/features/spaces/pages/index/space-viewer.i18n";
import { formatNumber } from "./format";

// app/ratel/src/features/spaces/pages/index/waiting_card/component.rs (`WaitingCard`).

const pad2 = (n: number) => String(n).padStart(2, "0");

export function WaitingCard({ prereqs }: { prereqs: SpaceActionSummary[] }) {
  const tr = useSpaceViewerI18n();
  const t = useEnumI18n();
  const space = useSpace();
  const participants = formatNumber(space.participants);
  const startedAt = space.started_at;
  const [remainingSecs, setRemainingSecs] = React.useState(0);

  // Rust: a 1s loop from mount until the start time passes.
  React.useEffect(() => {
    if (startedAt === null) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    const tick = () => {
      const diff = Math.trunc((startedAt - Date.now()) / 1000);
      setRemainingSecs(Math.max(diff, 0));
      if (diff <= 0 || cancelled) return;
      timer = setTimeout(tick, 1000);
    };
    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // Rust's effect reads no signal, so it runs once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const days = Math.trunc(remainingSecs / 86400);
  const hours = Math.trunc((remainingSecs % 86400) / 3600);
  const minutes = Math.trunc((remainingSecs % 3600) / 60);
  const seconds = remainingSecs % 60;

  return (
    <div className="waiting-card" data-testid="card-waiting">
      <div className="waiting-card__icon">
        <svg
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      </div>

      <span className="waiting-card__heading">{tr.waitingHeading}</span>

      {startedAt !== null && remainingSecs > 0 && (
        <div className="waiting-card__countdown">
          <span className="waiting-card__countdown-label">{tr.waitingStartsIn}</span>
          <div className="waiting-card__countdown-timer">
            {days > 0 && (
              <div className="waiting-card__countdown-unit">
                <span className="waiting-card__countdown-value">{days}</span>
                <span className="waiting-card__countdown-suffix">{tr.waitingDays}</span>
              </div>
            )}
            <div className="waiting-card__countdown-unit">
              <span className="waiting-card__countdown-value">{pad2(hours)}</span>
              <span className="waiting-card__countdown-suffix">{tr.waitingHours}</span>
            </div>
            <div className="waiting-card__countdown-unit">
              <span className="waiting-card__countdown-value">{pad2(minutes)}</span>
              <span className="waiting-card__countdown-suffix">{tr.waitingMinutes}</span>
            </div>
            <div className="waiting-card__countdown-unit">
              <span className="waiting-card__countdown-value">{pad2(seconds)}</span>
              <span className="waiting-card__countdown-suffix">{tr.waitingSeconds}</span>
            </div>
          </div>
        </div>
      )}

      <div className="waiting-card__participants">
        <span className="waiting-card__participants-count">{participants}</span>
        <span className="waiting-card__participants-label">{tr.waitingParticipants}</span>
      </div>

      {prereqs.length > 0 && (
        <div className="waiting-card__list">
          {prereqs.map((action) => (
            <div key={action.action_id} className="waiting-item">
              <div className="waiting-item__icon">
                <svg
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <div className="waiting-item__info">
                <span className="waiting-item__title">{action.title}</span>
                <span className="waiting-item__type">{t("SpaceActionType", action.action_type)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="waiting-card__status">
        <div className="waiting-card__pulse" />
        {tr.waitingStatus}
      </div>
    </div>
  );
}
