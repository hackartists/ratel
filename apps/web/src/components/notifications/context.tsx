// app/ratel/src/features/notifications/hooks/{use_unread_count.rs,use_inbox.rs}
// and the `NotificationsBootstrap` of app/ratel/src/root_layout.rs.
//
// Two controllers, each in its own context:
//   - `UnreadCount` — the unread badge count, polled every 60s while signed in
//     (Rust `UnreadCountSignal`);
//   - `Inbox` — the paginated inbox with the unread-only toggle, mark-read on
//     item click (then an SPA navigation to the payload url) and mark-all-read
//     (Rust `UseInbox`).
//
// `NotificationsProvider` installs the global pair around the route outlet.
// A space page shadows both for its subtree with `useProvideSpaceInbox(spaceId)`
// + `<NotificationsScope>` (or `<SpaceNotificationsProvider>`), exactly like
// `SpaceIndexPage` calls `use_provide_space_unread_count` +
// `use_provide_space_inbox`: the nearest provider wins, so the in-space bell
// and panel see only that space. Providers render no DOM.
import * as React from "react";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ApiError } from "@ratel/ts-bridges";
import type { InboxNotificationResponse, SpacePartition, UnreadCountResponse } from "@ratel/ts-bridges";
import {
  listInboxInfiniteKey,
  useGetUnreadCount,
  useListInboxInfinite,
  useMarkAllRead,
  useMarkRead,
  type BookmarkPage,
} from "@ratel/ts-bridges/hooks";
import { useAuth } from "@/lib/auth";
import { deepLinkPath } from "./deep-link";
import { usePush } from "./push";

/** Rust `POLL_INTERVAL_SECS`. */
const POLL_INTERVAL_MS = 60_000;

/** Rust `UnreadCountSignal`: the count plus the setter "mark all read" uses. */
export interface UnreadCount {
  count: number;
  set(count: number): void;
}

/** Rust `UseInbox` (`InfiniteQuery` + `unread_only` + the two actions). */
export interface Inbox {
  /** Loaded notifications, newest first, de-duplicated. */
  items: InboxNotificationResponse[];
  /** Rust `InfiniteQuery::is_loading()`: a next page is in flight. */
  isLoading: boolean;
  /** The first page has not answered yet. */
  isBaseLoading: boolean;
  /** Rust `has_more()`: the last page returned a bookmark. */
  hasMore: boolean;
  /** Rust `next()`: load the next page. */
  next(): void;
  /** Rust `refresh()`: reload from the first page, keeping items until it answers. */
  refresh(): void;
  unreadOnly: boolean;
  setUnreadOnly(value: boolean): void;
  unreadCount: UnreadCount;
  /** Rust `handle_item_click`: mark read, then navigate to the payload url (if any). */
  handleItemClick(item: InboxNotificationResponse): Promise<void>;
  /** Rust `handle_mark_all`: mark all read (in scope), zero the badge, refresh the list. */
  handleMarkAll(): Promise<void>;
  itemClickPending: boolean;
  markAllPending: boolean;
  /** Last action failure (Rust `Action::error()`); cleared by the next success. */
  error: ApiError | null;
}

const UnreadCountContext = React.createContext<UnreadCount | null>(null);
const InboxContext = React.createContext<Inbox | null>(null);

const asApiError = (e: unknown) => (e instanceof ApiError ? e : new ApiError(0, String(e)));

/** Builds an `UnreadCount` for the global inbox (`spaceId` null) or one space. */
function useProvideUnreadCount(spaceId: SpacePartition | null): UnreadCount {
  const { loggedIn } = useAuth();
  const queryClient = useQueryClient();
  const query = useGetUnreadCount(spaceId, {
    enabled: loggedIn,
    refetchInterval: POLL_INTERVAL_MS,
    // Rust's loop keeps polling while the tab is hidden.
    refetchIntervalInBackground: true,
    // Every sign-in refetches instead of showing a previous session's count.
    staleTime: 0,
    // A failed poll keeps the last value until the next tick, like Rust.
    retry: false,
  });

  const count = loggedIn ? (query.data?.count ?? 0) : 0;
  const set = React.useCallback(
    (next: number) => queryClient.setQueryData<UnreadCountResponse>(["getUnreadCount", spaceId], { count: next }),
    [queryClient, spaceId],
  );
  return React.useMemo(() => ({ count, set }), [count, set]);
}

/** Builds an `Inbox` for the global inbox (`spaceId` null) or one space. */
function useProvideInbox(spaceId: SpacePartition | null, unreadCount: UnreadCount): Inbox {
  const { loggedIn, userContext } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [unreadOnly, setUnreadOnly] = React.useState(false);
  const [error, setError] = React.useState<ApiError | null>(null);

  // Signed out: no request and no items (Rust returns an empty page without
  // calling the server). The user id keeps one account's pages from showing
  // under another after a re-login.
  const userKey = userContext.user?.pk ?? null;
  const queryKey = listInboxInfiniteKey(unreadOnly, spaceId, userKey);
  const list = useListInboxInfinite(unreadOnly, spaceId, userKey, { enabled: loggedIn });
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const refresh = () => {
    queryClient.setQueryData<InfiniteData<BookmarkPage<InboxNotificationResponse>, string | undefined>>(
      queryKey,
      (data) => data && { pages: data.pages.slice(0, 1), pageParams: data.pageParams.slice(0, 1) },
    );
    void queryClient.invalidateQueries({ queryKey, exact: true });
  };

  return {
    items: loggedIn ? list.items : [],
    isLoading: list.isFetchingNextPage,
    isBaseLoading: loggedIn && list.isPending,
    hasMore: loggedIn && list.hasMore,
    next: () => {
      if (list.isFetchingNextPage || !list.hasMore) return;
      void list.fetchNextPage();
    },
    refresh,
    unreadOnly,
    setUnreadOnly,
    unreadCount,
    handleItemClick: async (item) => {
      try {
        await markRead.mutateAsync(item.id);
      } catch (e) {
        setError(asApiError(e));
        return;
      }
      setError(null);
      const cta = item.payload.cta_url;
      // Relative route, so the tap stays an SPA navigation (see deep-link.ts).
      if (cta !== "") navigate(deepLinkPath(cta));
    },
    handleMarkAll: async () => {
      try {
        await markAllRead.mutateAsync({ spaceId });
      } catch (e) {
        setError(asApiError(e));
        return;
      }
      setError(null);
      unreadCount.set(0);
      refresh();
    },
    itemClickPending: markRead.isPending,
    markAllPending: markAllRead.isPending,
    error,
  };
}

export interface NotificationsScopeValue {
  unreadCount: UnreadCount;
  inbox: Inbox;
}

/** Installs a controller pair for `children`, shadowing any ancestor pair. */
export function NotificationsScope({ value, children }: { value: NotificationsScopeValue; children: React.ReactNode }) {
  return (
    <UnreadCountContext.Provider value={value.unreadCount}>
      <InboxContext.Provider value={value.inbox}>{children}</InboxContext.Provider>
    </UnreadCountContext.Provider>
  );
}

/**
 * Rust `use_provide_space_unread_count(space_id)` + `use_provide_space_inbox(space_id)`:
 * count, list and "mark all read" filtered to one space. Hand the result to
 * `<NotificationsScope>` around the space subtree.
 */
export function useProvideSpaceInbox(spaceId: SpacePartition): NotificationsScopeValue {
  const unreadCount = useProvideUnreadCount(spaceId);
  const inbox = useProvideInbox(spaceId, unreadCount);
  return { unreadCount, inbox };
}

/** `useProvideSpaceInbox` + `NotificationsScope` in one component. */
export function SpaceNotificationsProvider({ spaceId, children }: { spaceId: SpacePartition; children: React.ReactNode }) {
  const scope = useProvideSpaceInbox(spaceId);
  return <NotificationsScope value={scope}>{children}</NotificationsScope>;
}

/**
 * Rust `NotificationsBootstrap`: the global unread count and inbox plus push
 * wiring, mounted once around the route outlet regardless of sign-in state
 * (the queries stay idle while signed out).
 */
export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const unreadCount = useProvideUnreadCount(null);
  const inbox = useProvideInbox(null, unreadCount);
  usePush();
  return <NotificationsScope value={{ unreadCount, inbox }}>{children}</NotificationsScope>;
}

/** Rust `use_unread_count()`: the nearest (space or global) unread count. */
export function useUnreadCount(): UnreadCount {
  const value = React.useContext(UnreadCountContext);
  if (!value) throw new Error("useUnreadCount must be used inside NotificationsProvider");
  return value;
}

/** Rust `use_inbox()`: the nearest (space or global) inbox controller. */
export function useInbox(): Inbox {
  const value = React.useContext(InboxContext);
  if (!value) throw new Error("useInbox must be used inside NotificationsProvider");
  return value;
}
