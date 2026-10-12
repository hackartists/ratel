import { useNavigate } from "react-router-dom";
import { useSpaceAppsContext } from "@/layouts/space-apps-layout";
import { useToast } from "@/lib/toast";
import { CellPreviewTable } from "./components/cell-preview-table";
import { SamplingDashboard } from "./components/sampling-dashboard";
import { SamplingSettingsForm } from "./components/sampling-settings-form";
import { useSpaceSampling } from "./hooks/use-space-sampling";
import { useSpaceSamplingI18n } from "./i18n";

const DEFAULT_SPACE_LOGO = "https://metadata.ratel.foundation/logos/logo-symbol.png";

/**
 * `/spaces/:spaceId/apps/sampling` — the creator configures sampling and
 * watches per-group progress; everyone else gets the no-access fallback.
 */
export function Component() {
  const { role } = useSpaceAppsContext();
  return role === "Creator" ? <CreatorArena /> : <ViewerPage />;
}

function CreatorArena() {
  const tr = useSpaceSamplingI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const { spaceId, space } = useSpaceAppsContext();
  const sampling = useSpaceSampling(spaceId, space.status);
  const spaceLogo = space.logo === "" ? DEFAULT_SPACE_LOGO : space.logo;

  const onSave = () => {
    sampling
      .save()
      .then(() => toast.info(tr.saved))
      .catch((err) => toast.error(err));
  };

  return (
    <div className="space-panels-arena sampling-arena">
      <header className="spa-topbar" role="banner">
        <div className="spa-topbar__left">
          <button type="button" className="spa-back-btn" aria-label={tr.backAria} data-testid="topbar-back" onClick={() => navigate(-1)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
          </button>
          <img className="spa-topbar__logo" alt="Space logo" src={spaceLogo} />
          <nav className="spa-breadcrumb">
            <span className="spa-breadcrumb__item">{space.title}</span>
            <span className="spa-breadcrumb__sep">›</span>
            <span className="spa-breadcrumb__item">{tr.breadcrumbApps}</span>
            <span className="spa-breadcrumb__sep">›</span>
            <span className="spa-breadcrumb__item spa-breadcrumb__current">{tr.breadcrumbSampling}</span>
          </nav>
          <span className="spa-type-badge" data-testid="type-badge">
            {tr.typeBadge}
          </span>
          <span className="spa-topbar-title">{tr.topbarTitle}</span>
        </div>
      </header>

      <main className="spa-body">
        {sampling.locked && (
          <div className="spa-warn" data-testid="sampling-locked-notice">
            {tr.lockedNotice}
          </div>
        )}
        <SamplingSettingsForm sampling={sampling} />
        <CellPreviewTable cells={sampling.preview ?? (sampling.locked ? sampling.settings.cells : null)} />
        <div className="sampling-save-row">
          <button
            type="button"
            className="sampling-save-btn"
            data-testid="sampling-save"
            disabled={!sampling.canSave}
            onClick={onSave}
          >
            {sampling.saving ? tr.saving : tr.save}
          </button>
        </div>
        {sampling.dashboard && (
          <SamplingDashboard dashboard={sampling.dashboard} onRefresh={() => void sampling.refreshDashboard()} />
        )}
      </main>
    </div>
  );
}

function ViewerPage() {
  const tr = useSpaceSamplingI18n();
  const navigate = useNavigate();
  return (
    <div className="space-panels-arena">
      <div className="spa-viewer">
        <span className="spa-viewer__title">{tr.viewerNoAccess}</span>
        <button type="button" className="spa-viewer__btn" onClick={() => navigate(-1)}>
          {tr.viewerBack}
        </button>
      </div>
    </div>
  );
}
