// space-context: stand-in for the Dioxus `SpaceContextProvider`
// (app/ratel/src/features/spaces/space_common/providers/space_context_provider.rs)
// while the space layout and its shared context are ported in parallel.
//
// Loads the two loaders these pages read — `role` (`get_user_role`) and
// `space` (`get_space`) — with the generated hooks, suspending like
// `use_loader(...)?`. Every call site is marked `// space-context:` so it can
// switch to the shared context once it exists.
import { useSuspenseQuery } from "@tanstack/react-query";
import { getSpace, getUserRole } from "@ratel/ts-bridges";
import type { SpacePartition, SpaceResponse, SpaceUserRole } from "@ratel/ts-bridges";

export interface SpaceData {
  space: SpaceResponse;
  /** The real role (`ctx.role()`), not the Ongoing-adjusted `current_role`. */
  role: SpaceUserRole;
  /** `current_role`: a Creator reads as Participant while the space is Ongoing. */
  currentRole: SpaceUserRole;
}

/** `SpaceUserRole::can_edit` / `is_admin`. */
export function canEdit(role: SpaceUserRole): boolean {
  return role === "Creator";
}

export function useSpaceData(spaceId: SpacePartition): SpaceData {
  // Same query keys as the generated `useGetUserRole` / `useGetSpace` hooks so
  // the cache is shared with any page that uses those.
  const role = useSuspenseQuery({ queryKey: ["getUserRole", spaceId], queryFn: () => getUserRole(spaceId) });
  const space = useSuspenseQuery({ queryKey: ["getSpace", spaceId], queryFn: () => getSpace(spaceId) });
  const currentRole: SpaceUserRole =
    role.data === "Creator" && space.data.status === "Ongoing" ? "Participant" : role.data;
  return { space: space.data, role: role.data, currentRole };
}
