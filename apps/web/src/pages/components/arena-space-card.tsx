import type { MouseEvent } from "react";
import { useHomeArenaI18n } from "@/i18n/generated/views/index/home-arena.i18n";
import type { ActionChip, ChipKind, HeatCss } from "./format";

// app/ratel/src/views/index/space_card/component.rs (`ArenaSpaceCard`) — one
// slide of the home carousel. The whole card enters the space; the CTA stops
// propagation so a tap fires the action once. `active` seeds the focused state
// of the first card; the page script (`script.js`) owns `.active` afterwards.

export interface ArenaSpaceCardProps {
  heat: HeatCss;
  rank: string;
  logo: string;
  category: string;
  title: string;
  description: string;
  members: string;
  quests: string;
  heatDelta: string;
  chips: ActionChip[];
  rewardAmount: string;
  active?: boolean;
  onEnter?: () => void;
}

export function ArenaSpaceCard({
  heat,
  rank,
  logo,
  category,
  title,
  description,
  members,
  quests,
  heatDelta,
  chips,
  rewardAmount,
  active = false,
  onEnter,
}: ArenaSpaceCardProps) {
  const t = useHomeArenaI18n();
  const heatLabel = heat === "blazing" ? t.heatBlazing : heat === "trending" ? t.heatTrending : t.heatRising;

  return (
    <div
      className={`space-card space-card--${heat}${active ? " active" : ""}`}
      data-heat={heat}
      role="button"
      tabIndex={0}
      onClick={() => onEnter?.()}
    >
      <div className="space-card__wave" />

      <div className="space-card__top">
        <span className={`space-card__heat space-card__heat--${heat}`}>
          <HeatIcon heat={heat} />
          {heatLabel}
        </span>
        <span className="space-card__rank">
          {`${t.rankLabel} `}
          <strong>{rank}</strong>
        </span>
      </div>

      <div className="space-card__identity">
        <img className="space-card__logo" src={logo} alt="" />
        <div className="space-card__id">
          <span className="space-card__category">{category}</span>
          <span className="space-card__title">{title}</span>
        </div>
      </div>

      <div className="space-card__desc">{description}</div>

      <div className="space-card__stats">
        <div className="space-stat">
          <span className="space-stat__value">{members}</span>
          <span className="space-stat__label">{t.statMembers}</span>
        </div>
        <div className="space-stat">
          <span className="space-stat__value">{quests}</span>
          <span className="space-stat__label">{t.statQuests}</span>
        </div>
        <div className="space-stat">
          <span className="space-stat__value">{heatDelta}</span>
          <span className="space-stat__label">{t.statHeat7d}</span>
        </div>
      </div>

      <div className="space-card__chips">
        {chips.map((chip, i) => (
          <span key={i} className={`action-chip ${chip.kind}`}>
            <ChipIcon kind={chip.kind} />
            {chip.label}
          </span>
        ))}
      </div>

      <div className="space-card__footer">
        <div className="space-card__reward">
          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v12" />
            <path d="M16 10H8" />
          </svg>
          {`${rewardAmount} CR`}
          <small>{t.rewardPool}</small>
        </div>
        <button
          className="space-card__cta"
          onClick={(evt: MouseEvent) => {
            evt.stopPropagation();
            onEnter?.();
          }}
        >
          {t.enterArena}
          <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function HeatIcon({ heat }: { heat: HeatCss }) {
  switch (heat) {
    case "blazing":
      return (
        <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
        </svg>
      );
    case "trending":
      return (
        <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      );
    default:
      return (
        <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
          <polyline points="17 6 23 6 23 12" />
        </svg>
      );
  }
}

function ChipIcon({ kind }: { kind: ChipKind }) {
  switch (kind) {
    case "action-chip--poll":
      return (
        <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M18 20V10" />
          <path d="M12 20V4" />
          <path d="M6 20v-6" />
        </svg>
      );
    case "action-chip--discuss":
      return (
        <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "action-chip--quiz":
      return (
        <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    default:
      return (
        <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <line x1="19" y1="8" x2="19" y2="14" />
          <line x1="22" y1="11" x2="16" y2="11" />
        </svg>
      );
  }
}
