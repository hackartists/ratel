import { useNavigate, useParams } from "react-router-dom";
import { useSpaceAppsContext } from "@/layouts/space-apps-layout";
import { useSpaceAnalyzesAppI18n } from "@/i18n/generated/features/spaces/pages/apps/apps/analyzes/space-analyzes-app.i18n";
import { useLegacyScript } from "@/lib/legacy-scripts";
import reportScript from "../../../../../../../../../../app/ratel/src/features/spaces/pages/apps/apps/analyzes/views/report/script.js?url&no-inline";
import { DiscussionPanel } from "./components/discussion-panel";
import { FollowPanel } from "./components/follow-panel";
import { PollPanel } from "./components/poll-panel";
import { QuizPanel } from "./components/quiz-panel";
import { ReportBanner } from "./components/report-banner";
import { ReportSidebar } from "./components/report-sidebar";
import { AnalyzeReportDetailProvider, useAnalyzeReportDetail } from "./hooks/use-analyze-report-detail";

// app/ratel/src/features/spaces/pages/apps/apps/analyzes/views/report/mod.rs
// (`SpaceAnalyzeReportPage`). Read-only split-panel result view of a saved
// analyze report. Which panel is visible (`data-active`) and sidebar group
// collapse (`data-collapsed`) are owned by the unmodified `script.js`; React
// renders their initial values only.

const DEFAULT_SPACE_LOGO = "https://metadata.ratel.foundation/logos/logo-symbol.png";

export function Component() {
  const { spaceId = "", reportId = "" } = useParams();
  const tr = useSpaceAnalyzesAppI18n();
  const { space } = useSpaceAppsContext();
  const navigate = useNavigate();
  const ctrl = useAnalyzeReportDetail(spaceId, reportId);
  useLegacyScript(reportScript);

  const report = ctrl.detail.report;
  const spaceLogo = space.logo === "" ? DEFAULT_SPACE_LOGO : space.logo;

  return (
    <AnalyzeReportDetailProvider value={ctrl}>
      <div className="analyze-arena analyze-arena--detail">
        <div className="arena">
          <header className="arena-topbar" role="banner">
            <div className="arena-topbar__left">
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
              <span className="topbar-title" id="arena-title" data-testid="arena-title">
                {report.name}
              </span>
            </div>
          </header>

          <div className="split" data-mode="result">
            <ReportBanner report={report} spaceId={spaceId} />
            <main className="main">
              <PollPanel />
              <QuizPanel />
              <DiscussionPanel />
              <FollowPanel />
            </main>
            <ReportSidebar />
          </div>
        </div>
      </div>
    </AnalyzeReportDetailProvider>
  );
}
