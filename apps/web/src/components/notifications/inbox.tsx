// app/ratel/src/features/notifications/hooks/{use_inbox,use_unread_count}.rs —
// the `UseInbox` controller and the shared unread-count signal.
//
// Only the space-scoped installers are ported so far (`use_provide_space_unread_count`
// + `use_provide_space_inbox`, installed by `SpaceIndexPage`): `<InboxProvider spaceId>`.
// Passing `spaceId={null}` gives the global variant (`use_provide_inbox` +
// `use_unread_count`) for the root layout's future notification bootstrap.
//
//   const { inbox, unreadCount, setUnreadCount, handleItemClick, handleMarkAll } = useInbox();
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useInfiniteList } from "@ratel/ts-bridges/hooks";
import { getUnreadCountHandler, listInboxHandler, markAllReadHandler, markReadHandler } from "@ratel/ts-bridges";
import type { InboxNotificationResponse, SpacePartition } from "@ratel/ts-bridges";
import { useAuth } from "@/lib/auth";
import { deepLinkPath } from "./deep-link";

const POLL_INTERVAL_MS = 60_000;

export interface UseInbox {
  inbox: {
    items: InboxNotificationResponse[];
    isLoading: boolean;
    hasMore: boolean;
    next(): void;
    refresh(): void;
  };
  unreadOnly: boolean;
  setUnreadOnly(value: boolean): void;
  unreadCount: number;
  setUnreadCount(value: number): void;
  /** Rust `handle_item_click`: mark read, then SPA-navigate to the CTA. */
  handleItemClick(item: InboxNotificationResponse): Promise<void>;
  /** Rust `handle_mark_all`: mark all read (scoped), reset the badge, refresh the list. */
  handleMarkAll(): Promise<void>;
}

const InboxContext = React.createContext<UseInbox | null>(null);

export function InboxProvider({ spaceId, children }: { spaceId: SpacePartition | null; children: React.ReactNode }) {
  const { loggedIn } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [unreadOnly, setUnreadOnly] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState(0);

  // Polling loop: one request per interval while signed in (errors are only logged).
  React.useEffect(() => {
    if (!loggedIn) return;
    let cancelled = false;
    const tick = () => {
      getUnreadCountHandler(spaceId)
        .then((resp) => {
          if (!cancelled) setUnreadCount(resp.count);
        })
        .catch((e) => console.debug("unread count poll failed:", e));
    };
    tick();
    const timer = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [loggedIn, spaceId]);

  const queryKey = ["listInbox", "infinite", unreadOnly, spaceId, loggedIn] as const;
  const list = useInfiniteList<InboxNotificationResponse>(queryKey, (bookmark) =>
    loggedIn ? listInboxHandler(unreadOnly, spaceId, bookmark ?? null) : Promise.resolve({ items: [], bookmark: null }),
  );

  const value: UseInbox = {
    inbox: {
      items: list.items,
      isLoading: list.isPending || list.isFetchingNextPage,
      hasMore: list.hasMore,
      next: () => void list.fetchNextPage(),
      refresh: () => void queryClient.refetchQueries({ queryKey }),
    },
    unreadOnly,
    setUnreadOnly,
    unreadCount,
    setUnreadCount,
    handleItemClick: async (item) => {
      const cta = item.payload.cta_url;
      await markReadHandler(item.id);
      if (cta !== "") navigate(deepLinkPath(cta));
    },
    handleMarkAll: async () => {
      await markAllReadHandler(spaceId);
      setUnreadCount(0);
      await queryClient.refetchQueries({ queryKey });
    },
  };

  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>;
}

/** Rust `use_inbox()`. */
export function useInbox(): UseInbox {
  const ctx = React.useContext(InboxContext);
  if (!ctx) throw new Error("useInbox must be used under InboxProvider");
  return ctx;
}
