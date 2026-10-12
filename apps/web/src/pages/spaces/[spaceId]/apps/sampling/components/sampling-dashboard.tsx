import type { SamplingDashboardResponse } from "@ratel/ts-bridges";
import { useSpaceSamplingI18n } from "../i18n";
import { cellLabel } from "./cell-preview-table";

/**
 * Creator dashboard: per group target, population, selected (random only)
 * and entered counts, with "population short" and "filled" badges.
 */
export function SamplingDashboard({ dashboard, onRefresh }: { dashboard: SamplingDashboardResponse; onRefresh: () => void }) {
  const tr = useSpaceSamplingI18n();
  const showSelected = dashboard.method === "Random";
  const { totals } = dashboard;

  return (
    <section className="spa-section" data-testid="sampling-dashboard">
      <div className="spa-section__head">
        <div className="spa-section__title">
          <span className="spa-section__label">{tr.dashboardLabel}</span>
        </div>
        <div className="spa-section__actions">
          <span className="spa-section__hint">{tr.dashboardHint}</span>
          <button type="button" className="spa-btn" data-testid="sampling-dashboard-refresh" onClick={onRefresh}>
            {tr.refresh}
          </button>
        </div>
      </div>
      <div className="spa-table-wrap">
        <table className="spa-p-table">
          <thead>
            <tr>
              <th>{tr.colGroup}</th>
              <th>{tr.colTarget}</th>
              <th>{tr.colPopulation}</th>
              {showSelected && <th>{tr.colSelected}</th>}
              <th>{tr.colEntered}</th>
              <th>{tr.colStatus}</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.rows.map((row) => (
              <tr key={row.cell_key} data-testid={`sampling-dash-row-${row.position}`}>
                <td>{cellLabel(row.labels, tr.allRespondents)}</td>
                <td className="spa-num" data-testid={`sampling-dash-${row.position}-target`}>
                  {row.target}
                </td>
                <td className="spa-num" data-testid={`sampling-dash-${row.position}-population`}>
                  {row.population}
                </td>
                {showSelected && (
                  <td className="spa-num" data-testid={`sampling-dash-${row.position}-selected`}>
                    {row.selected}
                  </td>
                )}
                <td className="spa-num" data-testid={`sampling-dash-${row.position}-entered`}>
                  {row.entered}
                </td>
                <td>
                  <div className="sampling-badges">
                    {row.shortage && (
                      <span className="sampling-badge sampling-badge--shortage" data-testid={`sampling-badge-shortage-${row.position}`}>
                        {tr.shortage}
                      </span>
                    )}
                    {row.filled ? (
                      <span className="sampling-badge sampling-badge--filled" data-testid={`sampling-badge-filled-${row.position}`}>
                        {tr.filled}
                      </span>
                    ) : (
                      !row.shortage && <span className="sampling-badge">{tr.inProgress}</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            <tr className="sampling-total-row">
              <td>{tr.totalRow}</td>
              <td className="spa-num" data-testid="sampling-dash-total-target">
                {totals.target}
              </td>
              <td className="spa-num" data-testid="sampling-dash-total-population">
                {totals.population}
              </td>
              {showSelected && (
                <td className="spa-num" data-testid="sampling-dash-total-selected">
                  {totals.selected}
                </td>
              )}
              <td className="spa-num" data-testid="sampling-dash-total-entered">
                {totals.entered}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
