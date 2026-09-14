import { useSuspenseInfiniteQuery, type InfiniteData } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { listTeamPostsHandler } from "@ratel/ts-bridges";
import type { ListResponse, PostResponse } from "@ratel/ts-bridges";
import { useCreatePost } from "@ratel/ts-bridges/hooks";
import { useTeamArena } from "@/components/social/team-arena-context";

// app/ratel/src/features/social/pages/home/views/mod.rs (`Home`): the team
// posts feed (`use_infinite_query` over `list_team_posts_handler`) and the
// "Create Post" action.

type Bookmark = string | undefined;
type Page = ListResponse<PostResponse>;

const identity = (item: unknown) => JSON.stringify(item);

export interface TeamHomeFeed {
  items: PostResponse[];
  hasMore: boolean;
  loading: boolean;
  next(): void;
}

/**
 * `use_infinite_query(move |bookmark| list_team_posts_handler(username(), selected_category(), bookmark))?`:
 * suspends until the first page loads (a failure reaches the error boundary),
 * then pages by bookmark with the Rust hook's rules — items already loaded are
 * dropped, a page that adds nothing ends pagination, a failed page ends it too
 * (same rules as `useInfiniteList` in `@ratel/ts-bridges/hooks`).
 */
export function useTeamHomeFeed(username: string, category: string | null): TeamHomeFeed {
  const query = useSuspenseInfiniteQuery<Page, Error, InfiniteData<Page, Bookmark>, readonly unknown[], Bookmark>({
    queryKey: ["listTeamPosts", "infinite", username, category],
    queryFn: ({ pageParam }) => listTeamPostsHandler(username, category, pageParam ?? null),
    initialPageParam: undefined,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.bookmark === null) return undefined;
      if (allPages.length > 1) {
        const seen = new Set(allPages.slice(0, -1).flatMap((page) => page.items.map(identity)));
        if (lastPage.items.every((item) => seen.has(identity(item)))) return undefined;
      }
      return lastPage.bookmark;
    },
  });

  const seen = new Set<string>();
  const items: PostResponse[] = [];
  for (const page of query.data.pages) {
    for (const item of page.items) {
      const id = identity(item);
      if (seen.has(id)) continue;
      seen.add(id);
      items.push(item);
    }
  }

  return {
    items,
    hasMore: query.hasNextPage && !query.isFetchNextPageError,
    loading: query.isFetchingNextPage,
    next: () => {
      if (!query.isFetchingNextPage) void query.fetchNextPage();
    },
  };
}

/** `Partition` / `FeedPartition` wire value → the id Rust `FeedPartition` renders (prefix stripped). */
function partitionId(value: string): string {
  const hash = value.indexOf("#");
  return hash === -1 ? value : value.slice(hash + 1);
}

/**
 * The "Create Post" button (mod.rs:217-228): `create_post_handler(team_id)`
 * then `nav.push(Route::PostEdit { post_id })`; a failure is only logged.
 */
export function useCreateTeamPost(): () => Promise<void> {
  const arena = useTeamArena();
  const navigate = useNavigate();
  const createPost = useCreatePost();
  return async () => {
    try {
      const resp = await createPost.mutateAsync(arena.teamId);
      navigate(`/posts/${partitionId(resp.post_pk)}/edit`);
    } catch (e) {
      console.debug("Failed to create post:", e);
    }
  };
}

/** `PostResponse::url()`: the space when the post has one, else the post detail. */
export function postUrl(post: PostResponse): string {
  return post.space_pk !== null ? `/spaces/${partitionId(post.space_pk)}` : `/posts/${partitionId(post.pk)}`;
}
