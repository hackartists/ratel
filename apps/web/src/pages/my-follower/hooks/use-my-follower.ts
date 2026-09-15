import { useQueryClient, type InfiniteData, type QueryKey } from "@tanstack/react-query";
import { listFollowers, listFollowings } from "@ratel/ts-bridges";
import type { FollowUserItem, Partition } from "@ratel/ts-bridges";
import {
  useFollowUserPostApiMyFollowerFollow,
  useInfiniteList,
  useUnfollowUserDeleteApiMyFollowerFollow,
  type BookmarkPage,
} from "@ratel/ts-bridges/hooks";

// app/ratel/src/features/my_follower/views/home/mod.rs (`MyFollowerPage`) —
// the followers / followings infinite queries and the follow / unfollow
// mutations, which refresh both lists.

export type { FollowUserItem, Partition } from "@ratel/ts-bridges";

const FOLLOWERS_KEY = ["listFollowers", "infinite"] as const;
const FOLLOWINGS_KEY = ["listFollowings", "infinite"] as const;

export interface FollowQuery {
  items: FollowUserItem[];
  /** `is_loading()` — a next page is in flight. */
  loading: boolean;
  hasMore: boolean;
  next: () => void;
}

export interface UseMyFollower {
  /** False until both first pages resolve (the Rust loaders suspend until then). */
  ready: boolean;
  followers: FollowQuery;
  followings: FollowQuery;
  follow: (targetPk: Partition) => Promise<void>;
  unfollow: (targetPk: Partition) => Promise<void>;
}

// A failed FIRST page reaches the error boundary, like `use_loader(..)?`;
// a failed later page just ends pagination (useInfiniteList).
const throwOnFirstPage = {
  throwOnError: (_error: unknown, query: { state: { data: unknown } }) => query.state.data === undefined,
};

export function useMyFollower(): UseMyFollower {
  const queryClient = useQueryClient();
  const followersQuery = useInfiniteList(FOLLOWERS_KEY, (bookmark) => listFollowers(bookmark), throwOnFirstPage);
  const followingsQuery = useInfiniteList(FOLLOWINGS_KEY, (bookmark) => listFollowings(bookmark), throwOnFirstPage);
  const followMutation = useFollowUserPostApiMyFollowerFollow();
  const unfollowMutation = useUnfollowUserDeleteApiMyFollowerFollow();

  /** `InfiniteQuery::refresh` — reload from the first page, keeping items until it lands. */
  const refresh = (key: QueryKey) => {
    queryClient.setQueryData<InfiniteData<BookmarkPage<FollowUserItem>, string | undefined>>(key, (data) =>
      data ? { pages: data.pages.slice(0, 1), pageParams: data.pageParams.slice(0, 1) } : data,
    );
    void queryClient.invalidateQueries({ queryKey: key });
  };

  const refreshBoth = () => {
    refresh(FOLLOWERS_KEY);
    refresh(FOLLOWINGS_KEY);
  };

  const toFollowQuery = (query: typeof followersQuery): FollowQuery => ({
    items: query.items,
    loading: query.isFetchingNextPage,
    hasMore: query.hasMore,
    next: () => void query.fetchNextPage(),
  });

  return {
    ready: followersQuery.data !== undefined && followingsQuery.data !== undefined,
    followers: toFollowQuery(followersQuery),
    followings: toFollowQuery(followingsQuery),
    follow: async (targetPk) => {
      await followMutation.mutateAsync(targetPk);
      refreshBoth();
    },
    unfollow: async (targetPk) => {
      await unfollowMutation.mutateAsync(targetPk);
      refreshBoth();
    },
  };
}
