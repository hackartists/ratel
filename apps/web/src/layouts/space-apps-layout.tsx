import type { SpaceApp, SpaceResponse, SpaceUserRole } from "@ratel/ts-bridges";
import { useGetSpaceApps } from "@ratel/ts-bridges/hooks";
import { createContext, useContext } from "react";
import { Outlet, useParams } from "react-router-dom";
import { useSpaceContext } from "@/components/space/space-context";

// app/ratel/src/features/spaces/pages/apps/{layout,context}.rs — `SpaceAppsLayout`
// renders no DOM: it builds the app-scoped `Context { apps, space_ctx }` (suspending
// until `get_space_apps` resolves) and renders the outlet.
//
// `space_ctx` is the space layout's `SpaceContextProvider` (components/space/space-context.tsx),
// mounted by layouts/space-layout.tsx above this layout in the route tree — so
// `space` / `role` are read from there instead of a second fetch.

export interface SpaceAppsContextValue {
  spaceId: string;
  apps: SpaceApp[];
  /** `space_ctx.space()`. */
  space: SpaceResponse;
  /** `space_ctx.role()` — the persisted role, not the preview-aware `current_role`. */
  role: SpaceUserRole;
}

const SpaceAppsContext = createContext<SpaceAppsContextValue | null>(null);

/** Rust `use_space_apps_context()`. */
export function useSpaceAppsContext(): SpaceAppsContextValue {
  const ctx = useContext(SpaceAppsContext);
  if (!ctx) throw new Error("useSpaceAppsContext must be used under the space apps layout");
  return ctx;
}

export function Component() {
  const { spaceId = "" } = useParams();
  const apps = useGetSpaceApps(spaceId, { throwOnError: true });
  const { space, role } = useSpaceContext();

  // Suspended (renders nothing) until the apps list loads, like `?` in Rust.
  if (apps.data === undefined) return null;

  return (
    <SpaceAppsContext.Provider value={{ spaceId, apps: apps.data, space, role }}>
      <Outlet />
    </SpaceAppsContext.Provider>
  );
}
