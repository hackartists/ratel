import { SeoMeta } from "@/components/ui/seo-meta";
import { useFactFoldAdminStatsI18n } from "./i18n";
import { useAdminLiteralsI18n } from "../../admin-literals.i18n";

// app/ratel/src/features/arcade/games/fact_or_fold/pages/admin/stats/component.rs
// (`FactFoldAdminStatsPage`, `/admin/fact-or-fold/stats`): the round statistics
// shell with placeholder values until round data exists.
export function Component() {
  const tr = useFactFoldAdminStatsI18n();
  const lit = useAdminLiteralsI18n();
  return (
    <>
      <SeoMeta title={lit.fill("ff_page_title", { page: tr.pageTitle })} />
      <section className="ff-stats">
        <div className="ff-stats__notice">
          <strong>{tr.noticeTitle}</strong>
          <p>{tr.noticeBody}</p>
        </div>

        <div className="ff-stats__kpi">
          <StatsKpiTile label={tr.kpiTotalRounds} value="—" sub={tr.noData} />
          <StatsKpiTile label={tr.kpiAvgAccuracy} value="—" sub={tr.noData} />
          <StatsKpiTile label={tr.kpiInsiderWinRate} value="—" sub={tr.noData} />
          <StatsKpiTile label={tr.kpiAvgFlipCount} value="—" sub={tr.noData} />
        </div>

        <div className="ff-stats__panel">
          <header className="ff-stats__panel-head">
            <span className="ff-stats__panel-title">{tr.panelRecent}</span>
            <span className="ff-stats__panel-sub">{tr.panelRecentSub}</span>
          </header>
          <div className="ff-stats__chart-placeholder">
            <span>{tr.chartPlaceholder}</span>
          </div>
        </div>

        <div className="ff-stats__panel">
          <header className="ff-stats__panel-head">
            <span className="ff-stats__panel-title">{tr.panelBreakdown}</span>
            <span className="ff-stats__panel-sub">{tr.panelBreakdownSub}</span>
          </header>
          <div className="ff-stats__empty">{tr.empty}</div>
        </div>
      </section>
    </>
  );
}

function StatsKpiTile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="ff-stats__kpi-tile">
      <div className="ff-stats__kpi-label">{label}</div>
      <div className="ff-stats__kpi-value">{value}</div>
      <div className="ff-stats__kpi-sub">{sub}</div>
    </div>
  );
}
