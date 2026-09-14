import { useSuspenseQuery } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useState } from "react";
import {
  approveApplicationHandler,
  deleteAnnouncementHandler,
  findTeamHandler,
  listAnnouncementsHandler,
  listParentApplicationsHandler,
  listSubTeamsHandler,
  publishAnnouncementHandler,
  rejectApplicationHandler,
  returnApplicationHandler,
  updateSubTeamSettingsHandler,
} from "@ratel/ts-bridges";
import type {
  SubTeamAnnouncementResponse,
  SubTeamApplicationResponse,
  SubTeamListResponse,
  SubTeamSettingsResponse,
  TeamResponse,
  UpdateSubTeamSettingsRequest,
} from "@ratel/ts-bridges";
import { useTeamArena } from "@/components/social/use-wall-context";
import { useInfinitePages, type InfinitePages } from "./use-infinite-pages";

// The controllers the page shell installs in
// app/ratel/src/features/sub_team/pages/management/component.rs:
//   - the `find_team_handler` loader (username -> team pk),
//   - `use_sub_team_settings` (hooks/use_sub_team_settings.rs),
//   - `use_sub_team_list`     (hooks/use_sub_team_list.rs),
//   - `use_sub_team_queue`    (hooks/use_sub_team_queue.rs),
//   - `use_sub_team_broadcast`(hooks/use_sub_team_broadcast.rs).
// The tabs read them back through `useSubTeamManagement()` the way the Rust
// tabs re-use the contexts via `try_use_context`.

export interface UseSubTeamManagement {
  username: string;
  team: TeamResponse;
  /** `TeamPartition` — the id without the `TEAM#` prefix. */
  teamId: string;
  settings: SubTeamSettingsResponse;
  handleUpdateSettings: (req: UpdateSubTeamSettingsRequest) => void;
  teams: SubTeamListResponse;
  queue: InfinitePages<SubTeamApplicationResponse>;
  handleApprove: (applicationId: string, welcomeMessage: string) => void;
  handleReject: (applicationId: string, reason: string) => void;
  handleReturn: (applicationId: string, comment: string) => void;
  announcements: InfinitePages<SubTeamAnnouncementResponse>;
  handlePublish: (announcementId: string) => void;
  handleDelete: (announcementId: string) => void;
}

const ManagementContext = createContext<UseSubTeamManagement | null>(null);
export const SubTeamManagementProvider = ManagementContext.Provider;

export function useSubTeamManagement(): UseSubTeamManagement {
  const ctx = useContext(ManagementContext);
  if (!ctx) throw new Error("useSubTeamManagement must be used under SubTeamManagementProvider");
  return ctx;
}

/** `team_pk.parse::<TeamPartition>()` — accepts `TEAM#id` or a bare id. */
export function toTeamPartition(pk: string): string {
  return pk.startsWith("TEAM#") ? pk.slice("TEAM#".length) : pk;
}

/** Rust `use_action` swallows the error into `.error()`, which no UI here reads. */
function runAction(label: string, fn: () => Promise<unknown>): void {
  void fn().catch((e: unknown) => console.error(`${label} failed:`, e));
}

/** Builds every page-level controller. Suspends like the Rust `?`s. */
export function useSubTeamManagementProvider(username: string): UseSubTeamManagement {
  const teamResource = useSuspenseQuery({
    queryKey: ["findTeam", username],
    queryFn: () => findTeamHandler(username),
  });
  const team = teamResource.data;
  const teamId = toTeamPartition(team.pk);

  // ── use_sub_team_settings: seeded from TeamArenaContext ────────────
  const arena = useTeamArena(username); // wall-context: use_team_arena() seeds the settings signal
  const [settings, setSettings] = useState<SubTeamSettingsResponse>(() => ({
    is_parent_eligible: arena.isParentEligible, // wall-context: arena.is_parent_eligible()
    min_sub_team_members: arena.minSubTeamMembers, // wall-context: arena.min_sub_team_members()
    min_sub_team_age_days: arena.minSubTeamAgeDays, // wall-context: arena.min_sub_team_age_days()
  }));
  const handleUpdateSettings = useCallback(
    (req: UpdateSubTeamSettingsRequest) =>
      runAction("update_sub_team_settings", async () => {
        const updated = await updateSubTeamSettingsHandler(teamId, req);
        setSettings(updated);
      }),
    [teamId],
  );

  // ── use_sub_team_list ──────────────────────────────────────────────
  const teamsQuery = useSuspenseQuery({
    queryKey: ["subTeamManage", "listSubTeams", teamId],
    queryFn: () => listSubTeamsHandler(teamId, null),
  });
  const restartTeams = teamsQuery.refetch;

  // ── use_sub_team_queue (status filter: Pending) ────────────────────
  const queue = useInfinitePages<SubTeamApplicationResponse>(
    ["subTeamManage", "listParentApplications", teamId, "Pending"],
    (bookmark) => listParentApplicationsHandler(teamId, bookmark, "Pending"),
  );
  const refreshQueue = queue.refresh;
  const handleApprove = useCallback(
    (applicationId: string, welcomeMessage: string) =>
      runAction("approve_application", async () => {
        await approveApplicationHandler(teamId, applicationId, { reason: welcomeMessage });
        refreshQueue();
        void restartTeams();
      }),
    [teamId, refreshQueue, restartTeams],
  );
  const handleReject = useCallback(
    (applicationId: string, reason: string) =>
      runAction("reject_application", async () => {
        await rejectApplicationHandler(teamId, applicationId, { reason });
        refreshQueue();
      }),
    [teamId, refreshQueue],
  );
  const handleReturn = useCallback(
    (applicationId: string, comment: string) =>
      runAction("return_application", async () => {
        await returnApplicationHandler(teamId, applicationId, { comment });
        refreshQueue();
      }),
    [teamId, refreshQueue],
  );

  // ── use_sub_team_broadcast (status filter: None) ───────────────────
  const announcements = useInfinitePages<SubTeamAnnouncementResponse>(
    ["subTeamManage", "listAnnouncements", teamId],
    (bookmark) => listAnnouncementsHandler(teamId, bookmark, null),
  );
  const refreshAnnouncements = announcements.refresh;
  const handlePublish = useCallback(
    (announcementId: string) =>
      runAction("publish_announcement", async () => {
        await publishAnnouncementHandler(teamId, announcementId);
        refreshAnnouncements();
      }),
    [teamId, refreshAnnouncements],
  );
  const handleDelete = useCallback(
    (announcementId: string) =>
      runAction("delete_announcement", async () => {
        await deleteAnnouncementHandler(teamId, announcementId);
        refreshAnnouncements();
      }),
    [teamId, refreshAnnouncements],
  );

  return {
    username,
    team,
    teamId,
    settings,
    handleUpdateSettings,
    teams: teamsQuery.data,
    queue,
    handleApprove,
    handleReject,
    handleReturn,
    announcements,
    handlePublish,
    handleDelete,
  };
}
