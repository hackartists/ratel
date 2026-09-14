import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { getSpace, getUserRole } from "@ratel/ts-bridges";
import type { SpaceResponse, SpaceUserRole } from "@ratel/ts-bridges";

// Local stand-ins for app/ratel/src/features/spaces/space_common/providers
// (`SpaceContextProvider`) and hooks (`use_space`, `use_space_role`). The
// shared space context (apps/web/src/components/space/space-context.tsx) is
// being ported separately; every function here is a `space-context:` spot to
// switch over once it lands. Query keys match the scaffolded ts-bridges hooks
// (`useGetSpace`, `useGetUserRole`, `useListActions`, `useGetRanking`,
// `useGetMyScore`) so invalidation reaches every consumer.

/** Rust `use_space()()` — suspends until the space loads. */
export function useActionSpace(spaceId: string): SpaceResponse {
  // space-context: SpaceContextProvider.space
  return useSuspenseQuery({ queryKey: ["getSpace", spaceId], queryFn: () => getSpace(spaceId) }).data;
}

export interface ActionSpaceRole {
  /** `space_ctx.role()` — the role the server reports. */
  role: SpaceUserRole;
  /** `use_space_role()()` — a creator acts as a participant while the space is ongoing. */
  currentRole: SpaceUserRole;
  /** `space_ctx.role().is_admin()`. */
  isAdmin: boolean;
}

/** Rust `use_space_context().role` + `current_role` — suspends until both load. */
export function useActionSpaceRole(spaceId: string): ActionSpaceRole {
  // space-context: SpaceContextProvider.role / current_role
  const space = useActionSpace(spaceId);
  const role = useSuspenseQuery({
    queryKey: ["getUserRole", spaceId],
    queryFn: () => getUserRole(spaceId),
  }).data;
  const currentRole: SpaceUserRole = role === "Creator" && space.status === "Ongoing" ? "Participant" : role;
  return { role, currentRole, isAdmin: role === "Creator" };
}

/** Rust `space_ctx.ranking.restart(); space_ctx.my_score.restart();`. */
export function useRefreshSpaceScores(spaceId: string): () => void {
  // space-context: SpaceContextProvider.ranking / my_score
  const queryClient = useQueryClient();
  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["getRanking", spaceId] });
    void queryClient.invalidateQueries({ queryKey: ["getMyScore", spaceId] });
  }, [queryClient, spaceId]);
}

/** Rust `space_ctx.actions.restart()`. */
export function useRefreshSpaceActions(spaceId: string): () => void {
  // space-context: SpaceContextProvider.actions
  const queryClient = useQueryClient();
  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["listActions", spaceId] });
  }, [queryClient, spaceId]);
}
