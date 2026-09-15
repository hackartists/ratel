import {
  useQueryClient,
  useSuspenseInfiniteQuery,
  useSuspenseQuery,
  type InfiniteData,
} from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import {
  addTeamMemberHandler,
  findUserHandler,
  getTeamMemberPermissionHandler,
  listMembersHandler,
  removeTeamMemberHandler,
  updateMemberRoleHandler,
} from "@ratel/ts-bridges";
import { ApiError } from "@ratel/ts-bridges/runtime";
import type {
  AddTeamMemberResponse,
  FindUserQueryType,
  FoundUserResponse,
  ListResponse,
  TeamMemberPermission,
  TeamMemberResponse,
  TeamRole,
} from "@ratel/ts-bridges";

// Member API shared by `/:username/members` (app/ratel/src/features/social/pages/member/views/mod.rs)
// and `/:username/settings/members` (…/setting/team/views/management_page.rs).
// Only this module imports the generated member handlers; components consume
// these hooks.

export type { FindUserQueryType, FoundUserResponse, TeamMemberResponse, TeamRole } from "@ratel/ts-bridges";

/** `TeamRole::is_admin_or_owner`. */
export function isAdminOrOwner(role: TeamRole): boolean {
  return role === "owner" || role === "admin";
}

/** Rust `format!("{e}")` of a `common::Error` — the server's own message. */
export function errorDisplay(error: unknown): string {
  if (error instanceof ApiError) return error.server?.message ?? error.body;
  if (error instanceof Error) return error.message;
  return String(error);
}

const permissionKey = (username: string) => ["getTeamMemberPermission", username] as const;

/** `use_loader(get_team_member_permission_handler(username))?` — failures reach the error boundary. */
export function useTeamMemberPermission(username: string): TeamMemberPermission {
  return useSuspenseQuery({
    queryKey: permissionKey(username),
    queryFn: () => getTeamMemberPermissionHandler(username),
  }).data;
}

export type PermissionResult = { ok: true; data: TeamMemberPermission } | { ok: false };

/** Same loader, but the page renders its own fallback on failure (`.map_err(|e| e.to_string())`). */
export function useTeamMemberPermissionResult(username: string): PermissionResult {
  return useSuspenseQuery({
    queryKey: [...permissionKey(username), "result"],
    queryFn: async (): Promise<PermissionResult> => {
      try {
        return { ok: true, data: await getTeamMemberPermissionHandler(username) };
      } catch {
        return { ok: false };
      }
    },
  }).data;
}

type Page = ListResponse<TeamMemberResponse>;
type Bookmark = string | undefined;

const identity = (item: unknown) => JSON.stringify(item);

export interface MemberListOptions {
  /** `limit` query param (`None` → server default). */
  limit: number | null;
  /** Map a failed page to an empty `ListResponse::default()` instead of failing. */
  emptyOnError: boolean;
}

export interface TeamMemberList {
  /** `members_query.items()` — de-duplicated, in page order. */
  items: TeamMemberResponse[];
  /** `has_more()`. */
  hasMore: boolean;
  /** `is_loading()` — a next page is in flight. */
  isLoading: boolean;
  /** `next()`. */
  next: () => void;
  /** `refresh()` — reload the first page, keeping the items until it arrives. */
  refresh: () => void;
}

/**
 * `use_infinite_query(|bookmark| list_members_handler(team_pk, bookmark, limit))?`.
 * Suspends on the first page; a later page failing ends pagination.
 */
export function useTeamMemberList(teamPk: string, { limit, emptyOnError }: MemberListOptions): TeamMemberList {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["listMembers", teamPk, limit, emptyOnError, "infinite"] as const, [teamPk, limit, emptyOnError]);

  const query = useSuspenseInfiniteQuery<Page, ApiError, InfiniteData<Page, Bookmark>, typeof queryKey, Bookmark>({
    queryKey,
    queryFn: async ({ pageParam }) => {
      try {
        return await listMembersHandler(teamPk, pageParam, limit);
      } catch (error) {
        if (emptyOnError) return { items: [], bookmark: null };
        throw error;
      }
    },
    initialPageParam: undefined,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.bookmark === null) return undefined;
      // A page that appends nothing new ends pagination (Rust `if !appended`).
      if (allPages.length > 1) {
        const seen = new Set(allPages.slice(0, -1).flatMap((page) => page.items.map(identity)));
        if (lastPage.items.every((item) => seen.has(identity(item)))) return undefined;
      }
      return lastPage.bookmark;
    },
  });

  const items = useMemo(() => {
    const seen = new Set<string>();
    const out: TeamMemberResponse[] = [];
    for (const page of query.data.pages) {
      for (const item of page.items) {
        const id = identity(item);
        if (seen.has(id)) continue;
        seen.add(id);
        out.push(item);
      }
    }
    return out;
  }, [query.data]);

  const { fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError, isFetching } = query;
  // While `refresh()` reloads the first page Rust clears `next_bookmark`, so no sentinel shows.
  const refreshing = isFetching && !isFetchingNextPage;
  const hasMore = hasNextPage && !isFetchNextPageError && !refreshing;

  const next = useCallback(() => {
    if (isFetchingNextPage || !hasMore) return;
    void fetchNextPage();
  }, [fetchNextPage, hasMore, isFetchingNextPage]);

  const refresh = useCallback(() => {
    queryClient.setQueryData<InfiniteData<Page, Bookmark>>(queryKey, (data) =>
      data ? { pages: data.pages.slice(0, 1), pageParams: data.pageParams.slice(0, 1) } : data,
    );
    void queryClient.invalidateQueries({ queryKey, exact: true });
  }, [queryClient, queryKey]);

  return { items, hasMore, isLoading: isFetchingNextPage, next, refresh };
}

export interface TeamMemberActions {
  /** `find_user_handler(query_type, value)`. */
  findUser: (queryType: FindUserQueryType, value: string) => Promise<FoundUserResponse>;
  /** `add_team_member_handler(team_pk, AddTeamMemberRequest { user_pks, role })`. */
  addMembers: (teamPk: string, userPks: string[], role: TeamRole) => Promise<AddTeamMemberResponse>;
  /** `remove_team_member_handler(team_pk, RemoveMemberRequest { user_pks: vec![user_pk] })`. */
  removeMember: (teamPk: string, userPk: string) => Promise<void>;
  /** `update_member_role_handler(team_pk, UpdateMemberRoleRequest { user_pk, role })`. */
  updateRole: (teamPk: string, userPk: string, role: TeamRole) => Promise<void>;
}

const ACTIONS: TeamMemberActions = {
  findUser: (queryType, value) => findUserHandler(queryType, value),
  addMembers: (teamPk, userPks, role) => addTeamMemberHandler(teamPk, { user_pks: userPks, role }),
  removeMember: async (teamPk, userPk) => {
    await removeTeamMemberHandler(teamPk, { user_pks: [userPk] });
  },
  updateRole: async (teamPk, userPk, role) => {
    await updateMemberRoleHandler(teamPk, { user_pk: userPk, role });
  },
};

/** Member mutations. Callers refresh the list themselves, as each Rust call site does. */
export function useTeamMemberActions(): TeamMemberActions {
  return ACTIONS;
}
