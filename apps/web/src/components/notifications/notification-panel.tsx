import type * as React from "react";
import type { InboxNotificationResponse } from "@ratel/ts-bridges";
import { Bell, X } from "@/components/icons/lucide";
import { InfiniteScrollSentinel } from "@/components/ui/infinite-scroll-sentinel";
import { useEnumI18n } from "@/i18n/enums.i18n";
import { useNotificationsI18n } from "./i18n";
import { dataBool } from "@/lib/dom";
import { useInbox } from "./context";
import { getContents, relativeTime } from "./payload-contents";

// app/ratel/src/features/notifications/components/notification_panel/component.rs
// and notification_item/component.rs. The panel slides in via
// `.notification-panel[data-open="true"]` in main.css; unread rows are
// `.notification-item[aria-relevant="true"]`. The close button's `aria-label`
// is hardcoded English in Rust.

export interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationPanel({ open, onClose }: NotificationPanelProps) {
  const tr = useNotificationsI18n();
  const inbox = useInbox();
  const empty = inbox.items.length === 0 && !inbox.isLoading && !inbox.isBaseLoading;

  return (
    <div className="notification-panel" data-open={dataBool(open)} data-testid="notification-panel">
      <div className="notification-panel__header">
        <h3 className="notification-panel__title">{tr.panelTitle}</h3>
        <button
          className="notification-panel__mark-all"
          data-testid="mark-all-read"
          onClick={() => void inbox.handleMarkAll()}
        >
          {tr.markAllRead}
        </button>
        <button className="notification-panel__close" aria-label="Close" onClick={() => onClose()}>
          <X className="w-5 h-5 [&>path]:stroke-icon-primary" />
        </button>
      </div>
      <div className="notification-panel__list" data-testid="notification-list">
        {empty ? (
          <div className="notification-panel__empty">{tr.empty}</div>
        ) : (
          <>
            {inbox.items.map((item) => (
              <NotificationItem key={item.id} item={item} onClick={(it) => void inbox.handleItemClick(it)} />
            ))}
            <InfiniteScrollSentinel hasMore={inbox.hasMore} isLoading={inbox.isLoading} onNext={inbox.next} />
          </>
        )}
      </div>
    </div>
  );
}

interface NotificationItemProps {
  item: InboxNotificationResponse;
  onClick: (item: InboxNotificationResponse) => void;
}

export function NotificationItem({ item, onClick }: NotificationItemProps) {
  const tr = useNotificationsI18n();
  const translateEnum = useEnumI18n();
  const [title, body, avatarUrl] = getContents(item.payload, tr, translateEnum);
  const isUnread = !item.is_read;
  const rel = relativeTime(Date.now(), item.created_at, tr);
  // `aria-relevant` carries "true"/"false" here (a styling hook), which React's
  // ARIA typings don't allow.
  const unreadAttr = { "aria-relevant": dataBool(isUnread) } as unknown as React.ButtonHTMLAttributes<HTMLButtonElement>;

  return (
    <button className="notification-item" {...unreadAttr} data-testid="notification-item" onClick={() => onClick(item)}>
      <div className="notification-item__avatar">
        {avatarUrl ? <img src={avatarUrl} alt="" /> : <Bell className="w-5 h-5 [&>path]:stroke-icon-primary" />}
      </div>
      <div className="notification-item__body">
        <div className="notification-item__title">{title}</div>
        {body !== "" && <div className="notification-item__preview">{body}</div>}
        <div className="notification-item__time">{rel}</div>
      </div>
      {isUnread && <span className="notification-item__dot" data-testid="unread-dot" />}
    </button>
  );
}
