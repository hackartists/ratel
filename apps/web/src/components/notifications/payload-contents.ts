// app/ratel/src/features/notifications/types/payload_contents.rs
// (`InboxPayload::get_contents`) and the `relative_time` helper of
// components/notification_panel/notification_item/component.rs.
import type { ErrorCategory, InboxPayload, SocialPlatform } from "@ratel/ts-bridges";
import type { useEnumI18n } from "@/i18n/generated/enums.i18n";
import type { NotificationsI18n } from "@/i18n/generated/features/notifications/notifications.i18n";

type TranslateEnum = ReturnType<typeof useEnumI18n>;

/** Rust `SocialPlatform::display_name` (features/cross_posting/types/social_platform.rs). */
const PLATFORM_DISPLAY_NAME: Record<SocialPlatform, string> = {
  bluesky: "Bluesky",
  linkedin: "LinkedIn",
  threads: "Threads",
};

function crossPostingBody(tr: NotificationsI18n, category: ErrorCategory, platform: string): string {
  switch (category) {
    case "network_error":
      return tr.xpostFailedNetwork;
    case "rate_limited":
      return tr.xpostFailedRateLimit({ platform });
    case "auth_expired":
      return tr.xpostFailedAuthExpired({ platform });
    case "content_rejected":
      return tr.xpostFailedContentRejected({ platform });
    case "unknown":
      return tr.xpostFailedUnknown;
  }
}

/** `(title, body, avatar_url)` for one inbox payload, like the Rust match. */
export function getContents(
  payload: InboxPayload,
  tr: NotificationsI18n,
  translateEnum: TranslateEnum,
): [title: string, body: string, avatarUrl: string | null] {
  switch (payload.kind) {
    case "reply_on_comment":
      return [tr.replyTitle({ name: payload.replier_name }), payload.comment_preview, payload.replier_profile_url];
    case "mention_in_comment":
      return [tr.mentionTitle({ name: payload.mentioned_by_name }), payload.comment_preview, null];
    case "space_status_changed":
      return [
        tr.spaceStatusTitle({
          space: payload.space_title,
          // `SpaceStatus` is a string alias in the generated types; the value is
          // always a Rust variant name.
          status: translateEnum("SpaceStatus", payload.new_status as Parameters<TranslateEnum>[1]),
        }),
        "",
        null,
      ];
    case "space_invitation":
      return [tr.spaceInviteTitle({ name: payload.inviter_name, space: payload.space_title }), "", null];
    case "space_action_ongoing":
      return [
        tr.actionOngoingTitle({ action_title: payload.action_title }),
        tr.actionOngoingSubtitle({ space_title: payload.space_title }),
        null,
      ];
    case "sub_team_application_submitted":
      return [tr.subTeamAppSubmittedTitle({ team: payload.sub_team_name }), "", null];
    case "sub_team_application_approved":
      return [tr.subTeamAppApprovedTitle({ parent: payload.parent_team_name }), "", null];
    case "sub_team_application_rejected":
      return [tr.subTeamAppRejectedTitle({ parent: payload.parent_team_name }), payload.reason, null];
    case "sub_team_application_returned":
      return [tr.subTeamAppReturnedTitle({ parent: payload.parent_team_name }), payload.comment, null];
    case "sub_team_announcement_received":
      return [tr.subTeamAnnReceivedTitle({ parent: payload.parent_team_name }), payload.title, null];
    case "sub_team_announcement_comment":
      return [tr.subTeamAnnCommentTitle({ name: payload.commenter_name }), payload.comment_preview, null];
    case "sub_team_deregistered":
      return [tr.subTeamDeregisteredTitle({ parent: payload.former_parent_team_name }), payload.reason, null];
    case "sub_team_left_parent":
      return [tr.subTeamLeftParentTitle({ team: payload.former_sub_team_name }), payload.reason ?? "", null];
    case "sub_team_parent_deleted":
      return [tr.subTeamParentDeletedTitle({ parent: payload.former_parent_team_name }), "", null];
    case "cross_posting_failed": {
      const platform = PLATFORM_DISPLAY_NAME[payload.platform];
      return [tr.xpostFailedTitle({ platform }), crossPostingBody(tr, payload.error_category, platform), null];
    }
    case "discussion_comment_posted":
      return [
        tr.discussionCommentTitle({ name: payload.commenter_name, discussion: payload.discussion_title }),
        payload.comment_preview,
        payload.commenter_profile_url,
      ];
  }
}

/** Rust `relative_time(now_ms, then_ms, tr)`. */
export function relativeTime(nowMs: number, thenMs: number, tr: NotificationsI18n): string {
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
