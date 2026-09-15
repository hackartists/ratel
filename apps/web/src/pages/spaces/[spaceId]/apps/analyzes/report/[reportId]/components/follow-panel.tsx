import type { FollowTargetAggregate } from "@ratel/ts-bridges";
import { useSpaceAnalyzesAppI18n } from "@/pages/spaces/[spaceId]/apps/analyzes/space-analyzes-app.i18n";
import { useAnalyzeReportDetailContext } from "../hooks/use-analyze-report-detail";

// app/ratel/src/features/spaces/pages/apps/apps/analyzes/views/report/follow_panel/component.rs

export function FollowPanel() {
  const tr = useSpaceAnalyzesAppI18n();
  const ctrl = useAnalyzeReportDetailContext();
  const result = ctrl.detail.result;
  const respondent = Math.max(result?.respondent_count ?? 0, 1);
  const aggregates = result?.follow_aggregates ?? [];

  return (
    <section className="panel" data-panel="follow" data-active="false">
      <h1 className="main-title">
        <span className="main-title__chip main-title__chip--follow">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <line x1="20" y1="8" x2="20" y2="14" />
            <line x1="23" y1="11" x2="17" y2="11" />
          </svg>
          {tr.detailPanelChipFollow}
        </span>
        <span data-follow-title="true">{tr.detailFollowTitle}</span>
      </h1>

      <section className="card">
        <div className="card__head">
          <div className="card__title">{tr.detailFollowCardTitle}</div>
          <span className="card__count">{`${respondent}명 ${tr.detailSbItemMetaParticipants}`}</span>
        </div>
        <div className="follow-legend">
          <span className="follow-legend__item">
            <span className="follow-legend__swatch follow-legend__swatch--done" />
            {tr.detailFollowLegendDone}
          </span>
          <span className="follow-legend__item">
            <span className="follow-legend__swatch follow-legend__swatch--miss" />
            {tr.detailFollowLegendMiss}
          </span>
        </div>
        {aggregates.length === 0 ? (
          <div className="card__hint">{tr.detailPanelEmptyFollow}</div>
        ) : (
          <div className="follow-list">
            {aggregates.map((t, idx) => (
              <FollowTargetRow key={`follow-${idx}-${t.user_pk}`} target={t} respondentTotal={respondent} />
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function FollowTargetRow({ target, respondentTotal }: { target: FollowTargetAggregate; respondentTotal: number }) {
  const total = Math.max(respondentTotal, 1);
  const pct = Math.min(Math.max((target.count / total) * 100, 0), 100);
  const display = target.display_name === "" ? target.username : target.display_name;
  const handle = target.username === "" ? "" : `@${target.username}`;
  const avatar =
    target.profile_url === ""
      ? `https://api.dicebear.com/7.x/personas/svg?seed=${target.user_pk}`
      : target.profile_url;

  return (
    <div className="follow-row">
      <div className="follow-row__user">
        <img className="follow-row__avatar" src={avatar} alt="" />
        <div className="follow-row__meta">
          <span className="follow-row__name">{display}</span>
          <span className="follow-row__handle">{handle}</span>
        </div>
      </div>
      <div className="follow-row__bar">
        <div className="follow-row__bar-done" style={{ width: `${pct.toFixed(1)}%` }} />
      </div>
      <div className="follow-row__stats">
        <span className="follow-row__rate">{`${pct.toFixed(1)}%`}</span>
        <span className="follow-row__count">{`${target.count} / ${respondentTotal}`}</span>
      </div>
    </div>
  );
}
