// app/ratel/src/features/spaces/pages/index/action_dashboard/follow_card/component.rs:29-30 —
// `let mut follow_users = use_loader(move || async move { list_follow_users(space_id(), None).await })?;`
//
// Suspends until loaded; `restart()` is Rust `follow_users.restart()` (re-fetch,
// keeping the previous data on screen).
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  listFollowUsers,
  type FollowListFollowUsersFollowUserItem,
  type ListResponse,
  type SpacePartition,
} from "@ratel/ts-bridges";

/** Same key as the scaffolded `useListFollowUsers(spaceId, null)` hook. */
export const followUsersQueryKey = (spaceId: SpacePartition) => ["listFollowUsers", spaceId, null] as const;

export function useFollowUsers(spaceId: SpacePartition): {
  followUsers: ListResponse<FollowListFollowUsersFollowUserItem>;
  restart: () => Promise<void>;
} {
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery({
    queryKey: followUsersQueryKey(spaceId),
    queryFn: () => listFollowUsers(spaceId, null),
  });
  const restart = () =>
    queryClient.refetchQueries({ queryKey: followUsersQueryKey(spaceId), exact: true }).then(() => undefined);
  return { followUsers: data, restart };
}
