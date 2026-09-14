import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useInstallSpaceApp } from "@ratel/ts-bridges/hooks";
import { getSpaceApps } from "@ratel/ts-bridges";
import type { SpaceAppType } from "@ratel/ts-bridges";
import { File as FileIcon } from "@/components/icons/file";
import { Apps } from "@/components/icons/layouts";
import { Settings2 } from "@/components/icons/settings";
import { UserGroup } from "@/components/icons/user";
import { useEnumI18n } from "@/i18n/generated/enums.i18n";
import { useSpaceViewerI18n } from "@/i18n/generated/features/spaces/pages/index/space-viewer.i18n";
import { useSpaceAppTypeI18n } from "@/i18n/generated/features/spaces/pages/apps/types/space-app-type.i18n";
import { useToast } from "@/lib/toast";

// app/ratel/src/features/spaces/pages/index/settings_panel/apps_section/component.rs (`AppsSection`)
// + SpaceAppType helpers (pages/apps/types/space_app_type.rs). The variant list is the
// generated `SpaceAppType` (the non-`beta` build, like the reference app).

const VARIANTS: SpaceAppType[] = ["General", "File", "Analyzes", "Panels", "Report"];

const isDefaultApp = (t: SpaceAppType) => t === "General" || t === "File";

/** Rust `SpaceAppType::settings_path`. */
function settingsPath(t: SpaceAppType, spaceId: string): string {
  switch (t) {
    case "General":
      return `/spaces/${spaceId}/apps/general`;
    case "File":
      return `/spaces/${spaceId}/apps/files`;
    case "Analyzes":
      return `/spaces/${spaceId}/apps/analyzes`;
    case "Panels":
      return `/spaces/${spaceId}/apps/panels`;
    case "Report":
      return `/spaces/${spaceId}/report`;
  }
}

export function AppsSection({ spaceId }: { spaceId: string }) {
  const tr = useSpaceViewerI18n();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const install = useInstallSpaceApp();
  const appsKey = ["getSpaceApps", spaceId] as const;
  const { data: spaceApps } = useSuspenseQuery({ queryKey: appsKey, queryFn: () => getSpaceApps(spaceId) });
  const installedTypes = spaceApps.map((app) => app.app_type);
  const installedApps = VARIANTS.filter((t) => isDefaultApp(t) || installedTypes.includes(t));
  const availableApps = VARIANTS.filter((t) => !isDefaultApp(t) && !installedTypes.includes(t));
  const [inProgress, setInProgress] = React.useState<SpaceAppType | null>(null);

  return (
    <section className="settings-section apps-section" data-testid="apps-section">
      <div className="settings-section__sublabel">
        <span className="settings-section__sublabel-text">{tr.installedApps}</span>
        <span className="settings-section__sublabel-count">{installedApps.length}</span>
      </div>
      {installedApps.map((appType) => (
        <AppRow
          key={appType}
          appType={appType}
          installed
          inProgress={inProgress === appType}
          onClick={() => navigate(settingsPath(appType, spaceId))}
        />
      ))}
      {availableApps.length > 0 && (
        <>
          <div className="settings-section__sublabel">
            <span className="settings-section__sublabel-text">{tr.availableApps}</span>
            <span className="settings-section__sublabel-count">{availableApps.length}</span>
          </div>
          {availableApps.map((appType) => (
            <AppRow
              key={appType}
              appType={appType}
              installed={false}
              inProgress={inProgress === appType}
              onClick={async () => {
                if (inProgress !== null) return;
                setInProgress(appType);
                try {
                  await install.mutateAsync({ spaceId, appType });
                  setInProgress(null);
                  void queryClient.refetchQueries({ queryKey: appsKey, exact: true });
                } catch (err) {
                  setInProgress(null);
                  toast.error(err);
                }
              }}
            />
          ))}
        </>
      )}
    </section>
  );
}

function AppIcon({ appType }: { appType: SpaceAppType }) {
  switch (appType) {
    case "General":
      return (
        <Settings2
          width="24"
          height="24"
          className="text-white [&>path]:fill-current [&>circle]:stroke-current [&>circle]:fill-none"
        />
      );
    case "Analyzes":
      return <Apps width="24" height="24" className="text-white [&>path]:stroke-black" />;
    case "File":
    case "Report":
      return <FileIcon width="24" height="24" className="text-white [&>path]:stroke-current [&>path]:fill-none" />;
    case "Panels":
      return <UserGroup width="24" height="24" className="text-white [&>path]:stroke-current [&>path]:fill-transparent" />;
  }
}

function AppRow({
  appType,
  installed,
  inProgress,
  onClick,
}: {
  appType: SpaceAppType;
  installed: boolean;
  inProgress: boolean;
  onClick: () => void;
}) {
  const tr = useSpaceViewerI18n();
  const t = useEnumI18n();
  const descTr = useSpaceAppTypeI18n();
  const iconClass = {
    General: "app-row__icon app-row__icon--general",
    File: "app-row__icon app-row__icon--file",
    Analyzes: "app-row__icon app-row__icon--analyze",
    Panels: "app-row__icon app-row__icon--panel",
    Report: "app-row__icon app-row__icon--general",
  }[appType];
  const desc = {
    File: descTr.appDescriptionFile,
    Analyzes: descTr.appDescriptionAnalyzes,
    Panels: descTr.appDescriptionPanels,
    General: descTr.appDescriptionGeneral,
    Report: descTr.appDescriptionReport,
  }[appType];
  const appSlug = appType.toLowerCase();

  return (
    <div className="app-row">
      <div className={iconClass}>
        <AppIcon appType={appType} />
      </div>
      <div className="app-row__info">
        <div className="app-row__name-line">
          <span className="app-row__name">{t("SpaceAppType", appType)}</span>
          {installed && (
            <span className="app-row__check">
              <svg
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
          )}
        </div>
        <div className="app-row__desc">{desc}</div>
      </div>
      <div className="app-row__action">
        {installed ? (
          <button className="app-row-btn" data-testid={`settings-app-${appSlug}`} disabled={inProgress} onClick={() => onClick()}>
            {tr.settingsBtn}
          </button>
        ) : (
          <button
            className="app-row-btn app-row-btn--install"
            data-testid={`install-app-${appSlug}`}
            disabled={inProgress}
            onClick={() => onClick()}
          >
            <svg
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <line x1="12" x2="12" y1="5" y2="19" />
              <line x1="5" x2="19" y1="12" y2="12" />
            </svg>
            {tr.install}
          </button>
        )}
      </div>
    </div>
  );
}
