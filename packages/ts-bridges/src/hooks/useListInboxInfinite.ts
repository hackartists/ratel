// HAND-WRITTEN. Bookmark-paginated `GET /api/inbox` — the React side of the
// Rust `use_infinite_query(|bookmark| list_inbox_handler(Some(unread_only), space_id, bookmark))`
// in app/ratel/src/features/notifications/hooks/use_inbox.rs.
import type { QueryKey } from "@tanstack/react-query";
import { listInboxHandler } from "../handlers/listInboxHandler";
import type { InboxNotificationResponse } from "../types/InboxNotificationResponse";
import type { SpacePartition } from "../types/SpacePartition";
import { useInfiniteList, type UseInfiniteListOptions } from "./useInfiniteList";

/**
 * Query key. `userKey` (the signed-in user's id, or null) keeps one account's
 * pages from being shown to another after a re-login.
 */
export function listInboxInfiniteKey(
  unreadOnly: boolean,
  spaceId: SpacePartition | null,
  userKey: string | null,
): QueryKey {
  return ["listInbox", "infinite", unreadOnly, spaceId, userKey];
}

export function useListInboxInfinite(
  unreadOnly: boolean,
  spaceId: SpacePartition | null,
  userKey: string | null,
  options?: UseInfiniteListOptions<InboxNotificationResponse, QueryKey>,
) {
  return useInfiniteList<InboxNotificationResponse, QueryKey>(
    listInboxInfiniteKey(unreadOnly, spaceId, userKey),
    (bookmark) => listInboxHandler(unreadOnly, spaceId, bookmark),
    options,
  );
}
