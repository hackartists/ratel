import { listUserPostsHandler } from "@ratel/ts-bridges";
import type { PostResponse } from "@ratel/ts-bridges";
import { useSuspenseInfiniteList, type SuspenseInfiniteList } from "@ratel/ts-bridges/hooks";

/**
 * my_posts.rs:10-14 — `use_infinite_query(list_user_posts_handler(username, bookmark))?`:
 * suspends on the first page; a failure (e.g. a team handle →
 * `PostInvalidUsername`) reaches the error boundary.
 */
export function useMyPostsList(username: string): SuspenseInfiniteList<PostResponse> {
  return useSuspenseInfiniteList(["listUserPosts", "infinite", username], (bookmark) =>
    listUserPostsHandler(username, bookmark),
  );
}
