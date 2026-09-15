import { listFollowUsers } from "@ratel/ts-bridges";
import type { FollowListFollowUsersFollowUserItem } from "@ratel/ts-bridges";
import { useInfiniteList } from "@ratel/ts-bridges/hooks";

// `use_infinite_query(move |bookmark| list_follow_users(space_id(), bookmark))`
// shared by the creator target list and the viewer cards.

export type FollowUserItem = FollowListFollowUsersFollowUserItem;

export function useFollowUsers(spaceId: string) {
  const query = useInfiniteList(["listFollowUsers", spaceId, "infinite"], (bookmark) =>
    listFollowUsers(spaceId, bookmark ?? null),
  );
  return {
    /** The first page is still loading (the Rust hook suspends until then). */
    pending: query.isPending,
    users: query.items,
    hasMore: query.hasMore,
    isLoadingMore: query.isFetchingNextPage,
    loadMore: () => void query.fetchNextPage(),
    refresh: () => void query.refetch(),
  };
}
