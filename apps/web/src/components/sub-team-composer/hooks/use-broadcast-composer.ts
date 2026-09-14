import { useEffect, useRef, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { findTeamHandler, getAnnouncementHandler } from "@ratel/ts-bridges";
import type { File as SubTeamFile, SpaceType } from "@ratel/ts-bridges";
import {
  useCreateAnnouncement,
  useDeleteAnnouncement,
  usePublishAnnouncement,
  useUpdateAnnouncement,
} from "@ratel/ts-bridges/hooks";
import { toTeamId } from "../utils";

// Controller for the sub-team announcement composer — broadcast-to-all,
// edit, and direct-to-one-sub-team all share this. Mirrors
// app/ratel/src/features/sub_team/hooks/use_sub_team_broadcast_compose.rs
// (state + mutations) plus the autosave `use_effect` and publish/discard
// logic from `ComposeForm` in
// app/ratel/src/features/sub_team/pages/broadcast_compose/component.rs.
//
// Unlike the Rust version (where a Dioxus `use_effect` must live in the
// component but reads/writes hook-owned signals), a React hook can own its
// own effects — so the debounced autosave lives entirely in here, and the
// composer component just renders + calls the setters/actions below.

export type BroadcastDraftStatus = "idle" | "dirty" | "saving" | "saved" | "error";

export interface UseBroadcastComposer {
  teamId: string;
  teamDisplay: string;
  teamHandle: string;
  /** `true` for the direct-to-one-sub-team composer. */
  isDirect: boolean;
  announcementId: string | null;

  title: string;
  setTitle: (v: string) => void;
  htmlContents: string;
  setHtmlContents: (v: string) => void;
  tags: string[];
  setTags: (v: string[]) => void;
  attachments: SubTeamFile[];
  setAttachments: (v: SubTeamFile[]) => void;
  spaceEnabled: boolean;
  setSpaceEnabled: (v: boolean) => void;

  draftStatus: BroadcastDraftStatus;

  /** Awaits the publish request, then navigates to the target/management page. */
  publish: () => Promise<void>;
  /** Awaits the delete request (if a draft exists), then navigates away. */
  discard: () => Promise<void>;
}

export function useBroadcastComposer(
  username: string,
  announcementId0: string | undefined,
  targetChildTeamId: string | undefined,
): UseBroadcastComposer {
  const navigate = useNavigate();

  // Every route that uses this composer is declared OUTSIDE SocialLayout in
  // both apps (route.rs: announcements-compose/edit and the direct one-team
  // composer are full-screen pages before `#[layout(SocialLayout)]`;
  // route-tree.ts mirrors it) — no shared wall/team context is mounted
  // here, so Rust also loads the team locally via `find_team_handler`.
  const team = useSuspenseQuery({
    queryKey: ["findTeam", username],
    queryFn: () => findTeamHandler(username),
  }).data;
  const teamId = toTeamId(team.pk);

  const [announcementId, setAnnouncementId] = useState<string | null>(announcementId0 ?? null);

  // Keyed on the id the page mounted with (never changes), not the mutable
  // `announcementId` state — autosave promotes that from `null` to a fresh
  // id once the first draft is created, and re-keying a suspense query on
  // an id it has never fetched would suspend (and blank, `fallback={null}`)
  // the whole composer for a beat. We already have every field the initial
  // fetch would return sitting in local state by then.
  const initialAnnouncementId = announcementId0 ?? null;
  const loaded = useSuspenseQuery({
    queryKey: ["getAnnouncement", teamId, initialAnnouncementId],
    queryFn: async () => {
      if (!initialAnnouncementId) return null;
      return getAnnouncementHandler(teamId, initialAnnouncementId);
    },
  }).data;

  const [title, setTitle] = useState(loaded?.title ?? "");
  const [htmlContents, setHtmlContents] = useState(loaded && loaded.html_contents !== "" ? loaded.html_contents : loaded?.body ?? "");
  const [tags, setTags] = useState<string[]>(loaded?.tags ?? []);
  const [attachments, setAttachments] = useState<SubTeamFile[]>(loaded?.attachments ?? []);
  const [spaceEnabled, setSpaceEnabled] = useState(loaded?.space_enabled ?? false);
  const spaceTypeRef = useRef<SpaceType | null>(loaded?.space_type ?? null);

  const [draftStatus, setDraftStatus] = useState<BroadcastDraftStatus>("idle");

  const createMutation = useCreateAnnouncement();
  const updateMutation = useUpdateAnnouncement();
  const publishMutation = usePublishAnnouncement();
  const deleteMutation = useDeleteAnnouncement();

  // ── Autosave: debounce 500ms after the last edit, skip the mount-time run
  // (which would otherwise echo the just-loaded draft straight back). ──
  const seededRef = useRef(false);
  const versionRef = useRef(0);
  const announcementIdRef = useRef(announcementId);
  announcementIdRef.current = announcementId;

  useEffect(() => {
    if (!seededRef.current) {
      seededRef.current = true;
      return;
    }
    setDraftStatus("dirty");
    const version = ++versionRef.current;
    const timeoutId = setTimeout(() => {
      void (async () => {
        if (versionRef.current !== version) return; // superseded by a newer edit
        if (title === "" && htmlContents === "" && tags.length === 0 && attachments.length === 0 && !spaceEnabled) {
          return;
        }
        setDraftStatus("saving");
        try {
          const currentId = announcementIdRef.current;
          if (currentId) {
            await updateMutation.mutateAsync({
              teamPk: teamId,
              announcementId: currentId,
              body: {
                title,
                body: null,
                html_contents: htmlContents,
                tags,
                attachments,
                space_enabled: spaceEnabled,
                space_type: spaceTypeRef.current,
              },
            });
          } else {
            const created = await createMutation.mutateAsync({
              teamPk: teamId,
              body: {
                title,
                body: "",
                html_contents: htmlContents,
                tags,
                attachments,
                space_enabled: spaceEnabled,
                space_type: spaceTypeRef.current,
                target_child_team_id: targetChildTeamId ?? null,
              },
            });
            setAnnouncementId(created.id);
          }
          setDraftStatus("saved");
        } catch (e) {
          console.error("sub-team broadcast autosave failed:", e);
          setDraftStatus("error");
        }
      })();
    }, 500);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, htmlContents, tags, attachments, spaceEnabled]);

  const navigateAfter = () => {
    if (targetChildTeamId) {
      navigate(`/${username}/sub-teams/${targetChildTeamId}`);
    } else {
      navigate(`/${username}/sub-teams/manage`);
    }
  };

  return {
    teamId,
    teamDisplay: team.nickname || team.username,
    teamHandle: team.username,
    isDirect: targetChildTeamId !== undefined,
    announcementId,
    title,
    setTitle,
    htmlContents,
    setHtmlContents,
    tags,
    setTags,
    attachments,
    setAttachments,
    spaceEnabled,
    setSpaceEnabled,
    draftStatus,
    publish: async () => {
      if (announcementId) {
        await publishMutation.mutateAsync({ teamPk: teamId, announcementId });
      }
      navigateAfter();
    },
    discard: async () => {
      if (announcementId) {
        await deleteMutation.mutateAsync({ teamPk: teamId, announcementId });
      }
      navigateAfter();
    },
  };
}
