import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGeneralI18n } from "./i18n";
import { useSpaceAppsContext } from "@/layouts/space-apps-layout";
import { Administrators } from "./components/administrators";
import { DeleteSpacePopup } from "./components/delete-space-popup";
import { DEFAULT_SPACE_LOGO } from "./components/format";
import { InviteParticipant } from "./components/invite-participant";
import { SpaceLogoSetting } from "./components/space-logo-setting";
import { SpaceVisibilitySetting } from "./components/space-visibility-setting";
import { StartTimeSetting } from "./components/start-time-setting";
import { AnonymousSetting, JoinAnytimeSetting } from "./components/switch-settings";
import {
  SpaceGeneralSettingsProvider,
  useSpaceGeneralSettings,
  useSpaceGeneralSettingsController,
} from "./hooks/use-space-general-settings";

// app/ratel/src/features/spaces/pages/apps/apps/general/views/home/mod.rs
// (`SpaceGeneralAppPage`, `/spaces/:spaceId/apps/general`). Builds the settings
// controller once (suspending until its loaders resolve) and renders the arena
// topbar, the setting sections, the danger zone and the inline delete modal.
export function Component() {
  const { spaceId } = useSpaceAppsContext();
  const controller = useSpaceGeneralSettingsController(spaceId);
  if (!controller) return null;
  return (
    <SpaceGeneralSettingsProvider value={controller}>
      <SpaceGeneralAppPage />
    </SpaceGeneralSettingsProvider>
  );
}

function SpaceGeneralAppPage() {
  const tr = useGeneralI18n();
  const navigate = useNavigate();
  const { space } = useSpaceAppsContext();
  const { deleteSpaceAction } = useSpaceGeneralSettings();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const spaceLogo = space.logo === "" ? DEFAULT_SPACE_LOGO : space.logo;
  const spaceTitle = space.title;

  return (
    <div className="space-general-arena">
      <header className="sga-topbar" role="banner">
        <div className="sga-topbar__left">
          <button type="button" className="sga-back-btn" aria-label="Back" data-testid="topbar-back" onClick={() => navigate(-1)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
          </button>
          <img className="sga-topbar__logo" alt="Space logo" src={spaceLogo} />
          <nav className="sga-breadcrumb">
            <span className="sga-breadcrumb__item">{spaceTitle}</span>
            <span className="sga-breadcrumb__sep">›</span>
            <span className="sga-breadcrumb__item">Apps</span>
            <span className="sga-breadcrumb__sep">›</span>
            <span className="sga-breadcrumb__item sga-breadcrumb__current">General</span>
          </nav>
          <span className="sga-type-badge" data-testid="type-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            General
          </span>
          <span className="sga-topbar-title">General Settings</span>
        </div>
      </header>

      <main className="sga-body">
        <h1 className="sga-body__title">{tr.spaceSetting}</h1>

        <SpaceLogoSetting />
        <StartTimeSetting />
        <SpaceVisibilitySetting />
        <InviteParticipant />
        <AnonymousSetting />
        <JoinAnytimeSetting />
        <Administrators />

        <section className="sga-section sga-section--danger">
          <div className="sga-section__head">
            <span className="sga-section__label" style={{ color: "var(--arena-accent-red)", opacity: 0.85 }}>
              Danger zone
            </span>
          </div>
          <div className="sga-danger-row">
            <div className="sga-danger-row__text">
              <div className="sga-danger-row__title">{tr.deleteSpace}</div>
              <div className="sga-danger-row__sub">
                Permanently removes the space, all actions, and comments. Cannot be undone.
              </div>
            </div>
            <button
              type="button"
              className="sga-btn sga-btn--danger"
              disabled={deleteSpaceAction.pending}
              onClick={() => setDeleteOpen(true)}
            >
              {deleteSpaceAction.pending ? tr.deleting : tr.deleteSpace}
            </button>
          </div>
        </section>
      </main>

      <footer className="sga-footer">
        <div className="sga-footer__left">
          <span>Changes auto-save</span>
          <span className="sga-footer__pill">
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "var(--arena-accent-teal)",
                display: "inline-block",
              }}
            />
            Synced
          </span>
        </div>
      </footer>

      {deleteOpen && (
        <DeleteSpacePopup
          spaceTitle={spaceTitle}
          pending={deleteSpaceAction.pending}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={() => {
            setDeleteOpen(false);
            deleteSpaceAction.call();
          }}
        />
      )}
    </div>
  );
}
