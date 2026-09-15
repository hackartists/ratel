// HAND-WRITTEN. Bookmark-paginated `list_user_posts_handler`, the React
// counterpart of `use_infinite_query(move |bookmark| list_user_posts_handler(username, bookmark))`.
import { listUserPostsHandler } from "../handlers/listUserPostsHandler";
import type { PostResponse } from "../types/PostResponse";
import { useInfiniteList, type UseInfiniteListOptions } from "./useInfiniteList";

/**
 * An empty `username` resolves to an empty page without a request: callers
 * (the home "My Posts" tab) wire the query before the user is known, and the
 * backend rejects an empty username with `PostInvalidUsername`.
 */
export function useListUserPostsInfinite(
  username: string,
  options?: UseInfiniteListOptions<PostResponse, readonly ["listUserPostsInfinite", string]>,
) {
  return useInfiniteList(
    ["listUserPostsInfinite", username] as const,
    (bookmark) =>
      username === "" ? Promise.resolve({ items: [], bookmark: null }) : listUserPostsHandler(username, bookmark),
    options,
  );
}
