import { useHomeArenaI18n } from "@/i18n/generated/views/index/home-arena.i18n";
import { balanceText } from "./format";

// app/ratel/src/views/index/component.rs:615-686 — the bottom HUD: balance and
// the number of hot spaces. (The "Browse All" button is commented out in Rust.)

/** component.rs:637 */
const CREDIT_UNIT = "CR";

export function HomeBottomBar({ hasUser, activeSpaces }: { hasUser: boolean; activeSpaces: number }) {
  const t = useHomeArenaI18n();
  return (
    <div className="bottom-bar">
      <div className="hud-stat">
        <div className="hud-stat__icon">
          <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v12" />
            <path d="M16 10H8" />
          </svg>
        </div>
        <div className="hud-stat__body">
          <span className="hud-stat__label">{t.hudYourBalance}</span>
          <span className="hud-stat__value">
            <strong>{balanceText(hasUser)}</strong> <small>{CREDIT_UNIT}</small>
          </span>
        </div>
      </div>
      <div className="hud-stat hud-stat--rising">
        <div className="hud-stat__icon">
          <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            <polyline points="17 6 23 6 23 12" />
          </svg>
        </div>
        <div className="hud-stat__body">
          <span className="hud-stat__label">{t.hudHotRightNow}</span>
          <span className="hud-stat__value">
            <strong>{activeSpaces}</strong> <small>{t.hudActiveSpaces}</small>
          </span>
        </div>
      </div>
    </div>
  );
}
