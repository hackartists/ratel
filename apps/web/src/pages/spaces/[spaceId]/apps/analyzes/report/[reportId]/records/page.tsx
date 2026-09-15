import { keepPreviousData, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getAnalyzeReport, listAnalyzeRecords } from "@ratel/ts-bridges";
import type { AnalyzeRecordRow } from "@ratel/ts-bridges";
import { useInfiniteList } from "@ratel/ts-bridges/hooks";
import { RecordsTable } from "@/components/analyzes/records-table";
import { useSpaceAppsContext } from "@/layouts/space-apps-layout";
import { useSpaceAnalyzesAppI18n } from "@/i18n/generated/features/spaces/pages/apps/apps/analyzes/space-analyzes-app.i18n";
import { dataBool } from "@/lib/dom";

// app/ratel/src/features/spaces/pages/apps/apps/analyzes/views/records/component.rs
// (`SpaceAnalyzeRecordsPage`) + hooks/use_analyze_records.rs: the report's
// filter chips as tabs, and the hydrated source rows of the picked filter
// with "load more" pagination.

const DEFAULT_SPACE_LOGO = "https://metadata.ratel.foundation/logos/logo-symbol.png";

const EMPTY_PAGE = { items: [] as AnalyzeRecordRow[], bookmark: null };

function useAnalyzeRecords(spaceId: string, reportId: string) {
  const report = useSuspenseQuery({
    queryKey: ["getAnalyzeReport", spaceId, reportId],
    queryFn: () => getAnalyzeReport(spaceId, reportId),
  });
  const [selectedFilter, setSelectedFilter] = useState<number | null>(null);
  const records = useInfiniteList<AnalyzeRecordRow>(
    ["listAnalyzeRecords", spaceId, reportId, selectedFilter],
    (bookmark) =>
      selectedFilter === null
        ? Promise.resolve(EMPTY_PAGE)
        : listAnalyzeRecords(spaceId, reportId, selectedFilter, bookmark ?? null),
    { placeholderData: keepPreviousData },
  );
  return { report: report.data, selectedFilter, setSelectedFilter, records };
}

export function Component() {
  const { spaceId = "", reportId = "" } = useParams();
  const tr = useSpaceAnalyzesAppI18n();
  const { space } = useSpaceAppsContext();
  const navigate = useNavigate();
  const ctrl = useAnalyzeRecords(spaceId, reportId);

  const report = ctrl.report.report;
  const filters = report.filters;
  const spaceLogo = space.logo === "" ? DEFAULT_SPACE_LOGO : space.logo;
  const records = ctrl.records.items;
  const hasMore = ctrl.records.hasMore;
  const isLoading = ctrl.records.isFetchingNextPage;
  const activeSource = ctrl.selectedFilter === null ? undefined : filters[ctrl.selectedFilter]?.source;

  return (
    <div className="analyze-arena analyze-arena--records">
      <div className="arena">
        <header className="arena-topbar" role="banner">
          <button
            type="button"
            className="back-btn"
            aria-label={tr.detailBackBtnAria}
            data-testid="topbar-back"
            onClick={() => navigate(-1)}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
          </button>
          <img className="arena-topbar__logo" alt="Space logo" src={spaceLogo} />
          <nav className="breadcrumb">
            <span className="breadcrumb__item">{space.title}</span>
            <span className="breadcrumb__sep">›</span>
            <span className="breadcrumb__item">{report.name}</span>
            <span className="breadcrumb__sep">›</span>
            <span className="breadcrumb__item breadcrumb__current">{tr.recordsPageTitle}</span>
          </nav>
          <span className="topbar-title">{tr.recordsPageTitle}</span>
        </header>

        <section className="records-body">
          <header className="records-head">
            <h1>{tr.recordsPageTitle}</h1>
            <p>{tr.recordsPageHint}</p>
          </header>

          <div className="records-chips" role="tablist">
            {filters.map((f, idx) => (
              <button
                key={`records-chip-${idx}`}
                type="button"
                className="records-chip"
                role="tab"
                aria-pressed={dataBool(ctrl.selectedFilter === idx)}
                data-source={f.source}
                onClick={() => {
                  if (ctrl.selectedFilter === idx) void ctrl.records.refetch();
                  else ctrl.setSelectedFilter(idx);
                }}
              >
                <span className="records-chip__source">{f.source_label}</span>
                <span>{f.label}</span>
              </button>
            ))}
          </div>

          {activeSource !== undefined ? (
            <>
              <RecordsTable source={activeSource} rows={records} />
              {records.length === 0 && !isLoading && <div className="records-empty">{tr.recordsEmpty}</div>}
              {hasMore && (
                <div className="records-loadmore">
                  <button
                    type="button"
                    className="records-loadmore-btn"
                    disabled={isLoading}
                    onClick={() => void ctrl.records.fetchNextPage()}
                  >
                    {tr.recordsLoadMore}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="records-empty">{tr.recordsPageHint}</div>
          )}
        </section>
      </div>
    </div>
  );
}
