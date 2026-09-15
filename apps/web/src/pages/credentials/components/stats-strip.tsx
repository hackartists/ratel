import { useCredentialsI18n } from "@/i18n/generated/features/social/pages/credentials/views/credentials.i18n";
import { useCredentials } from "../hooks/use-credentials";
import { timeAgo } from "./format";

// `StatsStrip` (credentials/views/mod.rs).
export function StatsStrip() {
  const tr = useCredentialsI18n();
  const { summary } = useCredentials();
  const lastVerified = summary.last_verified_at !== null ? timeAgo(summary.last_verified_at) : tr.statNever;

  return (
    <div className="stats-strip">
      <div className="stat-card stat-card--violet">
        <div className="stat-card__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <div className="stat-card__body">
          <span className="stat-card__label">{tr.statAttributes}</span>
          <span className="stat-card__value">
            {`${summary.verified_count} `}
            <small>{`/ ${summary.total_slots} ${tr.statAttributesSub}`}</small>
          </span>
        </div>
      </div>
      <div className="stat-card stat-card--teal">
        <div className="stat-card__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
        </div>
        <div className="stat-card__body">
          <span className="stat-card__label">{tr.statMethods}</span>
          <span className="stat-card__value">
            {"2 "}
            <small>{tr.statMethodsSub}</small>
          </span>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-card__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <div className="stat-card__body">
          <span className="stat-card__label">{tr.statLastVerified}</span>
          <span className="stat-card__value">{lastVerified}</span>
        </div>
      </div>
    </div>
  );
}
