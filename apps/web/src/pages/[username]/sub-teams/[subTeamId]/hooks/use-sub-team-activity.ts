import { getSubTeamMemberActivityHandler } from "@ratel/ts-bridges";
import type { MemberActivityResponse, SubTeamAnnouncementResponse, SubTeamDetailResponse, TeamPartition } from "@ratel/ts-bridges";
import { useGetSubTeamDetail, useInfiniteList, useListDirectMessages } from "@ratel/ts-bridges/hooks";

// app/ratel/src/features/sub_team/hooks/use_sub_team_activity.rs
// (`UseSubTeamActivity`) — controller for the parent-admin sub-team detail
// (activity dashboard) page, `/:username/sub-teams/:subTeamId`. `:username`
// is the PARENT team; `:subTeamId` the child. The window toggle exists on
// the Rust struct but has no UI control on this page, so it's fixed here too.
const WINDOW = "Monthly" as const;

export interface UseSubTeamActivity {
  ready: boolean;
  detail: SubTeamDetailResponse;
  members: {
    items: MemberActivityResponse[];
    hasMore: boolean;
    loading: boolean;
    next: () => void;
  };
  directMessages: SubTeamAnnouncementResponse[];
}

const EMPTY_DETAIL: SubTeamDetailResponse = {
  sub_team_id: "",
  display_name: "",
  profile_url: "",
  username: "",
  recognized_at: 0,
  window: WINDOW,
  post_count: 0,
  space_count: 0,
  active_member_count: 0,
  total_member_count: 0,
  privacy_notice: { en: "", ko: "" },
};

/**
 * `format_last_active` (component.rs) — short relative label for the member
 * table / direct-message history rows: Today / Yesterday / "N days ago" (or
 * the Korean equivalents) within a week, `YYYY-MM-DD` (UTC) beyond that.
 */
export function formatLastActive(tsMs: number, isKo: boolean): string {
  if (tsMs <= 0) return "—";
  const now = Date.now();
  const diffDays = Math.max(0, Math.floor((now - tsMs) / 86_400_000));
  if (diffDays === 0) return isKo ? "오늘" : "Today";
  if (diffDays === 1) return isKo ? "어제" : "Yesterday";
  if (diffDays <= 6) return isKo ? `${diffDays}일 전` : `${diffDays} days ago`;
  const d = new Date(tsMs);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function useSubTeamActivity(teamId: TeamPartition, subTeamId: string): UseSubTeamActivity {
  const detailQuery = useGetSubTeamDetail(teamId, subTeamId, WINDOW);
  const membersQuery = useInfiniteList(["getSubTeamMemberActivity", teamId, subTeamId, WINDOW], (bookmark) =>
    getSubTeamMemberActivityHandler(teamId, subTeamId, WINDOW, bookmark ?? null),
  );
  const directMessagesQuery = useListDirectMessages(teamId, subTeamId);

  return {
    ready: detailQuery.data !== undefined && directMessagesQuery.data !== undefined,
    detail: detailQuery.data ?? EMPTY_DETAIL,
    members: {
      items: membersQuery.items,
      hasMore: membersQuery.hasMore,
      loading: membersQuery.isFetchingNextPage,
      next: () => void membersQuery.fetchNextPage(),
    },
    directMessages: directMessagesQuery.data?.items ?? [],
  };
}
