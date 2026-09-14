import type * as React from "react";
import type { InboxNotificationResponse, InboxPayload } from "@ratel/ts-bridges";
import { useEnumI18n } from "@/i18n/generated/enums.i18n";
import { useNotificationsI18n, type NotificationsI18n } from "@/i18n/generated/features/notifications/notifications.i18n";

// app/ratel/src/features/notifications/components/notification_panel/notification_item/component.rs
// + InboxPayload::get_contents (features/notifications/types/payload_contents.rs).

type EnumT = ReturnType<typeof useEnumI18n>;

function relativeTime(nowMs: number, thenMs: number, tr: NotificationsI18n): string {
  const diff = Math.max(nowMs - thenMs, 0);
  const secs = Math.floor(diff / 1000);
  const mins = Math.floor(secs / 60);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (secs < 60) return tr.relativeNow;
  if (mins < 60) return tr.relativeMinute({ n: mins });
  if (hours < 24) return tr.relativeHour({ n: hours });
  return tr.relativeDay({ n: days });
}

const PLATFORM_NAME = { bluesky: "Bluesky", linkedin: "LinkedIn", threads: "Threads" } as const;

/** Rust `InboxPayload::get_contents` → (title, body, avatar url). */
function contentsOf(p: InboxPayload, tr: NotificationsI18n, t: EnumT): [string, string, string | null] {
  switch (p.kind) {
    case "reply_on_comment":
      return [tr.replyTitle({ name: p.replier_name }), p.comment_preview, p.replier_profile_url];
    case "mention_in_comment":
      return [tr.mentionTitle({ name: p.mentioned_by_name }), p.comment_preview, null];
    case "space_status_changed":
      return [
        tr.spaceStatusTitle({
          space: p.space_title,
          status: t("SpaceStatus", p.new_status),
        }),
        "",
        null,
      ];
    case "space_invitation":
      return [tr.spaceInviteTitle({ name: p.inviter_name, space: p.space_title }), "", null];
    case "space_action_ongoing":
      return [
        tr.actionOngoingTitle({ action_title: p.action_title }),
        tr.actionOngoingSubtitle({ space_title: p.space_title }),
        null,
      ];
    case "sub_team_application_submitted":
      return [tr.subTeamAppSubmittedTitle({ team: p.sub_team_name }), "", null];
    case "sub_team_application_approved":
      return [tr.subTeamAppApprovedTitle({ parent: p.parent_team_name }), "", null];
    case "sub_team_application_rejected":
      return [tr.subTeamAppRejectedTitle({ parent: p.parent_team_name }), p.reason, null];
    case "sub_team_application_returned":
      return [tr.subTeamAppReturnedTitle({ parent: p.parent_team_name }), p.comment, null];
    case "sub_team_announcement_received":
      return [tr.subTeamAnnReceivedTitle({ parent: p.parent_team_name }), p.title, null];
    case "sub_team_announcement_comment":
      return [tr.subTeamAnnCommentTitle({ name: p.commenter_name }), p.comment_preview, null];
    case "sub_team_deregistered":
      return [tr.subTeamDeregisteredTitle({ parent: p.former_parent_team_name }), p.reason, null];
    case "sub_team_left_parent":
      return [tr.subTeamLeftParentTitle({ team: p.former_sub_team_name }), p.reason ?? "", null];
    case "sub_team_parent_deleted":
      return [tr.subTeamParentDeletedTitle({ parent: p.former_parent_team_name }), "", null];
    case "cross_posting_failed": {
      const platform = PLATFORM_NAME[p.platform];
      const body = {
        network_error: tr.xpostFailedNetwork,
        rate_limited: tr.xpostFailedRateLimit,
        auth_expired: tr.xpostFailedAuthExpired,
        content_rejected: tr.xpostFailedContentRejected,
        unknown: tr.xpostFailedUnknown,
      }[p.error_category];
      return [tr.xpostFailedTitle({ platform }), typeof body === "function" ? body({ platform }) : body, null];
    }
    case "discussion_comment_posted":
      return [
        tr.discussionCommentTitle({ name: p.commenter_name, discussion: p.discussion_title }),
        p.comment_preview,
        p.commenter_profile_url,
      ];
  }
}

export function NotificationItem({
  item,
  onClick,
}: {
  item: InboxNotificationResponse;
  onClick: (item: InboxNotificationResponse) => void;
}) {
  const tr = useNotificationsI18n();
  const t = useEnumI18n();
  const [title, body, avatarUrl] = contentsOf(item.payload, tr, t);
  const isUnread = !item.is_read;
  const rel = relativeTime(Date.now(), item.created_at, tr);

  return (
    <button
      className="notification-item"
      // `aria-relevant` is (mis)used as a boolean state hook for the unread style;
      // React's type only allows the ARIA tokens, so pass it untyped.
      {...({ "aria-relevant": isUnread ? "true" : "false" } as unknown as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      data-testid="notification-item"
      onClick={() => onClick(item)}
    >
      <div className="notification-item__avatar">
        {avatarUrl !== null && avatarUrl !== "" ? (
          <img src={avatarUrl} alt="" />
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5 [&>path]:stroke-icon-primary"
            width={24}
            height={24}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10.268 21a2 2 0 0 0 3.464 0" />
            <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
          </svg>
        )}
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
