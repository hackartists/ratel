import type * as React from "react";
import { dataBool } from "@/lib/dom";

// Sub-components of app/ratel/src/features/social/pages/home/views/mod.rs.

/** mod.rs `HudStat`. */
export function HudStat({
  label,
  valueMain,
  valueSmall,
  accent,
  icon,
}: {
  label: string;
  valueMain: string;
  valueSmall?: string;
  accent: boolean;
  icon: React.ReactNode;
}) {
  return (
    <div className={accent ? "hud-stat hud-stat--accent" : "hud-stat"}>
      <div className="hud-stat__icon">{icon}</div>
      <div className="hud-stat__body">
        <span className="hud-stat__label">{label}</span>
        <span className="hud-stat__value">
          <strong>{valueMain}</strong>
          {valueSmall !== undefined && (
            <>
              {" "}
              <small>{valueSmall}</small>
            </>
          )}
        </span>
      </div>
    </div>
  );
}

/** mod.rs `CatFilter` / `CatFilterItem` (same markup). */
export function CatFilter({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button className="cat-filter" type="button" aria-pressed={dataBool(active)} onClick={onClick}>
      {`${label} `}
      <span className="cat-filter__count">{count}</span>
    </button>
  );
}
