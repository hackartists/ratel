import { useNavigate } from "react-router-dom";
import { useSuspenseQuery } from "@tanstack/react-query";
import { listReports } from "@ratel/ts-bridges";
import type { ReportListItem } from "@ratel/ts-bridges";
import { useSpaceViewerI18n } from "@/i18n/generated/features/spaces/pages/index/space-viewer.i18n";

// app/ratel/src/features/spaces/pages/index/settings_panel/reports_section/component.rs
// (`ReportsSection`): published reports only; hidden while the list is empty.

export function ReportsSection({ spaceId }: { spaceId: string }) {
  const tr = useSpaceViewerI18n();
  const { data } = useSuspenseQuery({
    queryKey: ["listReports", spaceId, null, "Published"],
    queryFn: () => listReports(spaceId, null, "Published"),
  });
  const reports = data.items;
  if (reports.length === 0) return null;

  return (
    <section className="settings-section apps-section reports-section" data-testid="reports-section">
      <div className="settings-section__sublabel">
        <span className="settings-section__sublabel-text">{tr.reportsSectionLabel}</span>
        <span className="settings-section__sublabel-count">{reports.length}</span>
      </div>
      {reports.map((report) => (
        <ReportRow key={report.id} spaceId={spaceId} report={report} />
      ))}
    </section>
  );
}

function ReportRow({ spaceId, report }: { spaceId: string; report: ReportListItem }) {
  const tr = useSpaceViewerI18n();
  const navigate = useNavigate();
  return (
    <div className="app-row">
      <div className="app-row__icon app-row__icon--general">
        <svg
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.6"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" x2="8" y1="13" y2="13" />
          <line x1="16" x2="8" y1="17" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      </div>
      <div className="app-row__info">
        <div className="app-row__name-line">
          <span className="app-row__name">{report.title}</span>
        </div>
        <div className="app-row__desc">{report.description}</div>
      </div>
      <div className="app-row__action">
        <button
          className="app-row-btn"
          data-testid={`download-report-${report.id}`}
          onClick={() => navigate(`/spaces/${spaceId}/report/${report.id}`)}
        >
          {tr.reportDownloadBtn}
        </button>
      </div>
    </div>
  );
}
