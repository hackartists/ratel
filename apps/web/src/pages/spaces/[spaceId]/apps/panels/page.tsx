import { useNavigate } from "react-router-dom";
import { usePanelsI18n } from "@/i18n/generated/features/spaces/pages/apps/apps/panels/panels.i18n";
import { useSpaceAppsContext } from "@/layouts/space-apps-layout";
import { AttributeGroupsSection } from "./components/attribute-groups";
import { CollectivePanelSection } from "./components/collective-panel";
import { ConditionalTableSection } from "./components/conditional-table";
import { TotalQuota } from "./components/total-quota";
import { isCollectiveOption, isConditionalOption } from "./hooks/panel-logic";
import { SpacePanelsProvider, useSpacePanels, useSpacePanelsController } from "./hooks/use-space-panels";

// app/ratel/src/features/spaces/pages/apps/apps/panels/views/home/mod.rs
// (`SpacePanelsAppPage`, `/spaces/:spaceId/apps/panels`) — the creator gets the
// auto-saving panel settings arena, everyone else the no-access fallback. Gated
// on the persisted role, not the preview-aware one.

const DEFAULT_SPACE_LOGO = "https://metadata.ratel.foundation/logos/logo-symbol.png";

export function Component() {
  const { role } = useSpaceAppsContext();
  return role === "Creator" ? <CreatorArena /> : <ViewerPage />;
}

function CreatorArena() {
  const { spaceId } = useSpaceAppsContext();
  const controller = useSpacePanelsController(spaceId);
  if (!controller) return null;
  return (
    <SpacePanelsProvider value={controller}>
      <CreatorArenaPage />
    </SpacePanelsProvider>
  );
}

function CreatorArenaPage() {
  const tr = usePanelsI18n();
  const navigate = useNavigate();
  const { space } = useSpaceAppsContext();
  const { panels, isSaving } = useSpacePanels();

  const hasCollective =
    isCollectiveOption("University", panels) || isCollectiveOption("Age", panels) || isCollectiveOption("Gender", panels);
  const hasConditional = isConditionalOption("Age", panels) || isConditionalOption("Gender", panels);
  const spaceLogo = space.logo === "" ? DEFAULT_SPACE_LOGO : space.logo;

  return (
    <div className="space-panels-arena">
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
            <span className="spa-breadcrumb__item spa-breadcrumb__current">{tr.breadcrumbPanels}</span>
          </nav>
          <span className="spa-type-badge" data-testid="type-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            {tr.typeBadge}
          </span>
          <span className="spa-topbar-title">{tr.topbarTitle}</span>
        </div>
      </header>

      <main className="spa-body">
        <TotalQuota />
        <AttributeGroupsSection />
        {hasCollective && <CollectivePanelSection />}
        {hasConditional && <ConditionalTableSection />}
      </main>

      <footer className="spa-footer">
        <div className="spa-footer__left">
          {isSaving ? (
            <span className="spa-footer__pill spa-footer__pill--saving" data-testid="autosave-pill">
              <span className="spa-footer__pill-dot" />
              {tr.footerSaving}
            </span>
          ) : (
            <span className="spa-footer__pill" data-testid="autosave-pill">
              <span className="spa-footer__pill-dot" />
              {tr.footerSaved}
            </span>
          )}
        </div>
      </footer>
    </div>
  );
}

/** panels/views/home/viewer.rs */
function ViewerPage() {
  const tr = usePanelsI18n();
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
