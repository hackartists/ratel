import type { SpaceApp, SpaceResponse, SpaceUserRole } from "@ratel/ts-bridges";
import { useGetSpace, useGetSpaceApps, useGetUserRole } from "@ratel/ts-bridges/hooks";
import { createContext, useContext } from "react";
import { Outlet, useParams } from "react-router-dom";

// app/ratel/src/features/spaces/pages/apps/{layout,context}.rs — `SpaceAppsLayout`
// renders no DOM: it builds the app-scoped `Context { apps, space_ctx }` (suspending
// until `get_space_apps` resolves) and renders the outlet.
//
// `space_ctx` is the space layout's `SpaceContextProvider`. Until that context
// is ported (components/space/space-context.tsx), the space and the viewer's
// real role are loaded here with the same generated queries, so optimistic
// `setQueryData(["getSpace", id])` updates reach every consumer.

export interface SpaceAppsContextValue {
  spaceId: string;
  apps: SpaceApp[];
  /** space-context: `space_ctx.space()`. */
  space: SpaceResponse;
  /** space-context: `space_ctx.role()` — the persisted role, not the preview-aware `current_role`. */
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
  // space-context: replace with the shared space context's `space` / `role` once ported.
  const space = useGetSpace(spaceId, { throwOnError: true });
  const role = useGetUserRole(spaceId, { throwOnError: true });

  // Suspended (renders nothing) until every loader resolves, like `?` in Rust.
  if (apps.data === undefined || space.data === undefined || role.data === undefined) return null;

  return (
    <SpaceAppsContext.Provider value={{ spaceId, apps: apps.data, space: space.data, role: role.data }}>
      <Outlet />
    </SpaceAppsContext.Provider>
  );
}
