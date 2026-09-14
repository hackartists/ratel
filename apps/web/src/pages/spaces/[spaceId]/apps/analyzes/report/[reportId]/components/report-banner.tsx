import { useNavigate } from "react-router-dom";
import type { AnalyzeReport } from "@ratel/ts-bridges";
import { useSpaceAnalyzesAppI18n } from "@/i18n/generated/features/spaces/pages/apps/apps/analyzes/space-analyzes-app.i18n";

// app/ratel/src/features/spaces/pages/apps/apps/analyzes/views/report/banner/component.rs
// "Selected cross filters" strip above the split: the report's filter chips,
// the filter-count + creation-date meta line, and the records CTA.

/** chrono `Local.timestamp_millis_opt(ms).format("%Y.%m.%d %H:%M")`. */
function formatLocal(ms: number): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function ReportBanner({ report, spaceId }: { report: AnalyzeReport; spaceId: string }) {
  const tr = useSpaceAnalyzesAppI18n();
  const navigate = useNavigate();
  const isEmpty = report.filters.length === 0;
  const meta = `${tr.detailMetaFilterCount} ${report.filters.length}${tr.detailMetaFilterCountUnit} · ${tr.detailMetaCreatedPrefix} ${formatLocal(report.created_at)}`;

  return (
    <section className="builder-result" data-state="result">
      <div className="builder-result__chips-row">
        <div className="builder-result__topline">
          <span className="builder-result__label">{tr.detailActiveFiltersLabel}</span>
          <div className="builder-result__topline-right">
            <span className="builder-result__meta" id="result-meta" data-testid="result-meta">
              {meta}
            </span>
            {!isEmpty && (
              <button
                type="button"
                className="builder-result__records-btn"
                data-testid="result-records-btn"
                onClick={() => navigate(`/spaces/${spaceId}/apps/analyzes/report/${report.id}/records`)}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 3h18v4H3z" />
                  <path d="M3 11h18v4H3z" />
                  <path d="M3 19h18v2H3z" />
                </svg>
                <span>{tr.detailRecordsBtn}</span>
              </button>
            )}
          </div>
        </div>
        <div className="preview-chips" id="result-chips" data-testid="result-chips">
          {isEmpty ? (
            <span className="preview-chips__empty">{tr.detailActiveFiltersEmpty}</span>
          ) : (
            report.filters.map((f) => (
              <span key={`preview-chip-${f.item_id}-${f.option_id}`} className="preview-chip" data-source={f.source}>
                <span className="preview-chip__source">{f.source_label}</span>
                <span>{f.label}</span>
              </span>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
