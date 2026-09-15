// app/ratel/src/common/contexts/team_context.rs — `TeamContext`: the signed-in
// user's teams (`GET /api/me/teams`, loaded once while logged in, `[]` when
// signed out or on failure) plus the selected team index.
//
// Rust installs the context in `RootLayout`; here the team list lives in the
// react-query cache under the `useGetUserTeams` key, so every component that
// calls `useTeamContext()` shares one list, and `addTeam` / `createTeam`
// update that cached list the way `self.teams.push(..)` updates the loader.
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useCreateTeam, useGetUserTeams } from "@ratel/ts-bridges/hooks";
import type { ListResponse, TeamItem } from "@ratel/ts-bridges";
import { useAuth } from "@/lib/auth";

/** `["getUserTeams"]` — the scaffolded `useGetUserTeams` query key. */
const TEAMS_KEY = ["getUserTeams"] as const;

/** Rust `UserType::Team` (common/types/auth/user_type.rs:23). */
export const USER_TYPE_TEAM = 2;

/**
 * `TeamGroupPermissions::all()` as `u8`s (features/posts/types/team_group_permission.rs:34-47),
 * what `TeamContext::create_team` stores on the new team.
 */
export const TEAM_PERMISSIONS_ALL = [0, 1, 2, 3, 10, 11, 12, 13, 20, 21, 22];

/**
 * `TeamRole::Admin.into()` (features/social/pages/member/dto/team_role.rs:39-50, 72-77):
 * the Admin bitmask decoded back in declaration order.
 */
export const TEAM_ROLE_ADMIN_PERMISSIONS = [0, 1, 2, 3, 10, 11, 12, 13, 21, 22];

/** Rust `TeamCreationPayload` (common/components/team_creation_form). */
export interface TeamCreationPayload {
  profile_url: string;
  username: string;
  nickname: string;
  description: string;
}

// `selected_index: Signal<usize>` — one value for the whole app.
let selectedIndex = 0;
const listeners = new Set<() => void>();
function setSelectedIndex(index: number): void {
  if (index === selectedIndex) return;
  selectedIndex = index;
  for (const l of listeners) l();
}
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export interface TeamContext {
  /** False until the first team list has answered (the Rust loader suspends until then). */
  ready: boolean;
  teams: TeamItem[];
  selectedIndex: number;
  selectedTeam: TeamItem | null;
  setTeams(teams: TeamItem[]): void;
  addTeam(team: TeamItem): void;
  selectTeamByIdx(index: number): void;
  selectTeam(teamPk: string): void;
  /** `create_team_handler`, then pushes the new team (full permissions, `created_at: 0`). */
  createTeam(payload: TeamCreationPayload): Promise<TeamItem>;
}

export function useTeamContext(): TeamContext {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const loggedIn = auth.loggedIn;
  // `get_user_teams_handler().await.unwrap_or_default()`: a failure reads as no teams.
  const query = useGetUserTeams({ enabled: auth.ready && loggedIn, retry: false });
  const createTeamMutation = useCreateTeam();
  const index = useSyncExternalStore(subscribe, () => selectedIndex, () => 0);

  const ready = auth.ready && (!loggedIn || query.data !== undefined || query.isError);
  const teams = useMemo(() => (loggedIn ? (query.data?.items ?? []) : []), [loggedIn, query.data]);

  const setTeams = useCallback(
    (next: TeamItem[]) =>
      queryClient.setQueryData<ListResponse<TeamItem>>(TEAMS_KEY, (old) => ({ items: next, bookmark: old?.bookmark ?? null })),
    [queryClient],
  );
  const addTeam = useCallback(
    (team: TeamItem) =>
      queryClient.setQueryData<ListResponse<TeamItem>>(TEAMS_KEY, (old) => ({
        items: [...(old?.items ?? []), team],
        bookmark: old?.bookmark ?? null,
      })),
    [queryClient],
  );
  const selectTeam = useCallback(
    (teamPk: string) => {
      const items = queryClient.getQueryData<ListResponse<TeamItem>>(TEAMS_KEY)?.items ?? [];
      const found = items.findIndex((t) => t.pk === teamPk);
      if (found >= 0) setSelectedIndex(found);
    },
    [queryClient],
  );

  return {
    ready,
    teams,
    selectedIndex: index,
    selectedTeam: teams[index] ?? null,
    setTeams,
    addTeam,
    selectTeamByIdx: setSelectedIndex,
    selectTeam,
    createTeam: async ({ profile_url, username, nickname, description }) => {
      const response = await createTeamMutation.mutateAsync({ username, nickname, profile_url, description });
      const team: TeamItem = {
        pk: response.team_pk,
        nickname,
        username,
        profile_url,
        user_type: USER_TYPE_TEAM,
        permissions: TEAM_PERMISSIONS_ALL,
        description,
        created_at: 0,
        member_count: 1,
      };
      addTeam(team);
      return team;
    },
  };
}
