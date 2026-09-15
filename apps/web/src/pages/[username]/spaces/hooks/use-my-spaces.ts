import { listMySpacesHandler } from "@ratel/ts-bridges";
import type { MySpaceResponse } from "@ratel/ts-bridges";
import { useSuspenseInfiniteList, type SuspenseInfiniteList } from "@ratel/ts-bridges/hooks";
import { useUserContext } from "@/lib/auth";

/**
 * space/views/mod.rs:7-8 — `use_infinite_query(list_my_spaces_handler(bookmark, None))?`.
 * The list belongs to the signed-in viewer, so the cache is keyed by them.
 */
export function useMySpacesList(): SuspenseInfiniteList<MySpaceResponse> {
  const viewer = useUserContext().user?.pk ?? null;
  return useSuspenseInfiniteList(["listMySpaces", "infinite", viewer], (bookmark) => listMySpacesHandler(bookmark, null));
}
