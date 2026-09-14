import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { listAnalyzeReports } from "@ratel/ts-bridges";
import type { AnalyzeReport, AnalyzeReportStatus } from "@ratel/ts-bridges";
import { useSpaceData } from "@/components/space-data/use-space-data";
import { useSpaceAnalyzesAppI18n } from "@/i18n/generated/features/spaces/pages/apps/apps/analyzes/space-analyzes-app.i18n";
import { useLegacyScript } from "@/lib/legacy-scripts";
import { useToast } from "@/lib/toast";
import homeScript from "../../../../../../../../app/ratel/src/features/spaces/pages/apps/apps/analyzes/views/home/script.js?url&no-inline";

// app/ratel/src/features/spaces/pages/apps/apps/analyzes/views/home/mod.rs
// (`SpaceAnalyzesAppPage`). Creators get the carousel; everyone else a
// minimal "no access" splash. Gates on the REAL role, not `current_role`.

const DEFAULT_SPACE_LOGO = "https://metadata.ratel.foundation/logos/logo-symbol.png";

export function Component() {
  const { spaceId = "" } = useParams();
  const { role } = useSpaceData(spaceId); // space-context: `use_space_context().role()`

  if (role !== "Creator") {
    return <ViewerEmpty />;
  }
  return <AnalyzesListArena spaceId={spaceId} />;
}

/** `use_analyze_reports` — the saved-report list (`list_analyze_reports`, first page). */
function useAnalyzeReports(spaceId: string) {
  return useSuspenseQuery({
    queryKey: ["listAnalyzeReports", spaceId, null],
    queryFn: () => listAnalyzeReports(spaceId, null),
  });
}

/** Rust `AnalyzeReportStatus::as_str` — the mockup's CSS vocabulary. */
function statusAttr(status: AnalyzeReportStatus): string {
  switch (status) {
    case "in_progress":
      return "running";
    case "finish":
      return "done";
    case "failed":
      return "failed";
  }
}

function AnalyzesListArena({ spaceId }: { spaceId: string }) {
  const tr = useSpaceAnalyzesAppI18n();
  const { space } = useSpaceData(spaceId); // space-context: `use_space()`
  const navigate = useNavigate();
  const toast = useToast();
  useLegacyScript(homeScript);

  const reports = useAnalyzeReports(spaceId).data.items;
  const spaceLogo = space.logo === "" ? DEFAULT_SPACE_LOGO : space.logo;
  const countLabel = `${reports.length} ${tr.listCountUnit}`;

  return (
    <div className="analyze-arena analyze-arena--list">
      <div className="arena">
        <header className="arena-topbar" role="banner">
          <div className="arena-topbar__left">
            <button
              type="button"
              className="back-btn"
              aria-label="Back"
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
              <span className="breadcrumb__item">{tr.arenaBreadcrumbApps}</span>
              <span className="breadcrumb__sep">›</span>
              <span className="breadcrumb__item breadcrumb__current">{tr.arenaBreadcrumbCurrent}</span>
            </nav>
            <span className="type-badge" data-testid="type-badge">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 3v18h18" />
                <path d="M7 14l4-4 4 4 5-5" />
              </svg>
              {tr.arenaBreadcrumbCurrent}
            </span>
            <span className="topbar-title" id="arena-title">
              {tr.arenaTopbarTitle}
            </span>
          </div>
        </header>

        <div className="split" data-mode="list">
          <main className="main">
            <section className="analyze-builder" id="analyze-builder" data-mode="list">
              <div className="builder-list" data-state="list">
                <div className="builder-list-head">
                  <h2>{tr.listHeading}</h2>
                  <span className="builder-list-head__count" id="report-count" data-testid="report-count">
                    {countLabel}
                  </span>
                </div>
                <p className="builder-hint">{tr.listHint}</p>

                {/* Carousel — React renders structure only; script.js handles
                    scroll-snap, prev/next/dot clicks, and keyboard. */}
                <div className="report-carousel">
                  <button
                    type="button"
                    className="report-carousel__arrow report-carousel__arrow--prev"
                    id="report-prev"
                    data-testid="report-prev"
                    aria-label={tr.arrowPrevLabel}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>

                  <div className="report-carousel__viewport" id="report-viewport">
                    <div className="report-carousel__track" id="report-track">
                      {reports.map((rep) => (
                        <div key={rep.id} className="report-carousel__slide" data-card-type="saved">
                          <SavedReportCard
                            report={rep}
                            onClick={() => {
                              if (rep.status === "finish") {
                                navigate(`/spaces/${spaceId}/apps/analyzes/report/${rep.id}`);
                              } else {
                                toast.info(tr.listCardPendingToast);
                              }
                            }}
                          />
                        </div>
                      ))}
                      <div key="plus" className="report-carousel__slide" data-card-type="new">
                        <NewReportCard onClick={() => navigate(`/spaces/${spaceId}/apps/analyzes/create`)} />
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="report-carousel__arrow report-carousel__arrow--next"
                    id="report-next"
                    data-testid="report-next"
                    aria-label={tr.arrowNextLabel}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                </div>

                {/* Dots — one per slide. JS owns click handlers and the .active class. */}
                <div className="report-carousel__dots" id="report-dots">
                  {reports.map((rep) => (
                    <button
                      key={`dot-${rep.id}`}
                      type="button"
                      className="report-carousel__dot"
                      data-testid={`report-dot-${rep.id}`}
                      aria-label={tr.dotReportLabelPrefix}
                    />
                  ))}
                  <button
                    key="dot-plus"
                    type="button"
                    className="report-carousel__dot"
                    data-testid="report-dot-new"
                    aria-label={tr.dotNewLabel}
                  />
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}

function SavedReportCard({ report, onClick }: { report: AnalyzeReport; onClick: () => void }) {
  const tr = useSpaceAnalyzesAppI18n();
  const status = report.status;
  const statusLabel =
    status === "finish" ? tr.statusFinish : status === "in_progress" ? tr.statusInProgress : tr.statusFailed;
  const attr = statusAttr(status);

  return (
    <button
      type="button"
      className="report-card-large report-card-large--saved"
      data-report-id={report.id}
      data-status={attr}
      data-testid={`report-card-${report.id}`}
      onClick={onClick}
    >
      <span className="report-card-large__status" data-status={attr}>
        {status === "in_progress" ? (
          <span className="report-card-large__status-dot" />
        ) : (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
        {statusLabel}
      </span>

      <span className="report-card-large__icon report-card-large__icon--saved">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 3v18h18" />
          <path d="M7 14l4-4 4 4 5-5" />
        </svg>
      </span>
      <span className="report-card-large__title">{report.name}</span>

      {report.filters.length === 0 ? (
        <div className="report-card-large__chips">
          <span className="report-card-large__chips-empty">{tr.chipsEmpty}</span>
        </div>
      ) : (
        <div className="report-card-large__chips">
          {report.filters.map((f) => (
            <span key={`chip-${f.item_id}-${f.option_id}`} className="report-card-large__chip" data-source={f.source}>
              <span className="report-card-large__chip-source">{f.source_label.toUpperCase()}</span>
              <span className="report-card-large__chip-text">{f.label}</span>
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

function NewReportCard({ onClick }: { onClick: () => void }) {
  const tr = useSpaceAnalyzesAppI18n();
  return (
    <button
      type="button"
      className="report-card-large report-card-large--new"
      data-testid="report-card-new"
      onClick={onClick}
    >
      <span className="report-card-large__icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </span>
      <span className="report-card-large__title">{tr.newAnalysisTitle}</span>
      <span className="report-card-large__desc">{tr.newAnalysisDesc}</span>
    </button>
  );
}

function ViewerEmpty() {
  return (
    <div className="analyze-arena">
      <div className="arena-viewer">
        {/* Hardcoded in the Rust view as well. */}
        <span className="arena-viewer__title">No access</span>
      </div>
    </div>
  );
}
