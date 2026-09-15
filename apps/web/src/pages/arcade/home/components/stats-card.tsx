import type { UserStatsResponse } from "@ratel/ts-bridges";
import { useArcadeHomeI18n } from "@/pages/arcade/i18n";

// app/ratel/src/features/arcade/pages/home/component.rs — `StatsCard`.

export function StatsCard({ stats }: { stats: UserStatsResponse }) {
  const tr = useArcadeHomeI18n();
  const accuracy = `${Math.max(stats.accuracy_bps / 100, 0).toFixed(1)}%`;
  const delta = stats.lifetime_delta_chips;
  const deltaLabel = delta >= 0 ? `+${delta}` : `${delta}`;
  const playedLabel = stats.last_played_at > 0 ? formatRelativeDate(stats.last_played_at) : tr.statsNever;

  return (
    <div className="my-stats-card">
      <div className="section-head">
        <h2>{tr.statsCardTitle}</h2>
        <span className="sub">{tr.statsCardSub}</span>
      </div>
      <div className="my-stats-row">
        <span>{tr.statsRounds}</span>
        <span className="num">{stats.total_rounds}</span>
      </div>
      <div className="my-stats-row">
        <span>{tr.statsAccuracy}</span>
        <span className="num teal">{accuracy}</span>
      </div>
      <div className="my-stats-row">
        <span>{tr.statsDelta}</span>
        <span className={delta >= 0 ? "num gold" : "num pink"}>{deltaLabel}</span>
      </div>
      <div className="my-stats-row">
        <span>{tr.statsLastPlayed}</span>
        <span className="num">{playedLabel}</span>
      </div>
    </div>
  );
}

/** `format_relative_date` — English-only in Rust as well. */
function formatRelativeDate(tsMs: number): string {
  const diffDays = Math.floor(Math.max(Date.now() - tsMs, 0) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}
