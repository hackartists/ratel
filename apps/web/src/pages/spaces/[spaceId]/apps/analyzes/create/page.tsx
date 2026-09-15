import { useNavigate, useParams } from "react-router-dom";
import { useSpaceAppsContext } from "@/layouts/space-apps-layout";
import { useSpaceAnalyzesAppI18n } from "@/pages/spaces/[spaceId]/apps/analyzes/space-analyzes-app.i18n";
import { CfSunjiCard } from "./components/cf-sunji-card";
import { CrossFilterCard } from "./components/cross-filter-card";
import { FooterCreate, FooterPreview } from "./components/footers";
import { PreviewCard } from "./components/preview-card";
import { AnalyzeCreateProvider, useAnalyzeCreate } from "./hooks/use-analyze-create";

// app/ratel/src/features/spaces/pages/apps/apps/analyzes/views/create/mod.rs
// (`SpaceAnalyzeCreatePage`). Two-step wizard (CREATE → PREVIEW): arena shell,
// the step's cards, and the two page-level fixed footers.

const DEFAULT_SPACE_LOGO = "https://metadata.ratel.foundation/logos/logo-symbol.png";

export function Component() {
  const { spaceId = "" } = useParams();
  const tr = useSpaceAnalyzesAppI18n();
  const { space } = useSpaceAppsContext();
  const navigate = useNavigate();
  const ctrl = useAnalyzeCreate(spaceId);
  const spaceLogo = space.logo === "" ? DEFAULT_SPACE_LOGO : space.logo;

  return (
    <AnalyzeCreateProvider value={ctrl}>
      <div className="analyze-arena analyze-arena--create">
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
              <span className="topbar-title" id="arena-title" data-testid="arena-title">
                {tr.createTopbarTitle}
              </span>
            </div>
          </header>

          <div className="split" data-mode={ctrl.mode}>
            <main className="main">
              <section className="analyze-builder" id="analyze-builder" data-mode={ctrl.mode}>
                {ctrl.mode === "create" ? (
                  <div className="builder-create" data-state="create">
                    <CrossFilterCard />
                    <CfSunjiCard />
                  </div>
                ) : (
                  <PreviewCard />
                )}
              </section>
            </main>
          </div>

          <FooterCreate />
          <FooterPreview />
        </div>
      </div>
    </AnalyzeCreateProvider>
  );
}
