import { useSuspenseQuery } from "@tanstack/react-query";
import { listActions } from "@ratel/ts-bridges";
import type { SpaceActionSummary } from "@ratel/ts-bridges";

// `use_loader(move || list_actions(space_id()))?` — suspends until the space's
// actions load. Same key as the scaffolded `useListActions` hook, so
// `useRefreshSpaceActions` / invalidation reaches every list on screen.
export function useSpaceActionList(spaceId: string): SpaceActionSummary[] {
  return useSuspenseQuery({ queryKey: ["listActions", spaceId], queryFn: () => listActions(spaceId) }).data;
}
