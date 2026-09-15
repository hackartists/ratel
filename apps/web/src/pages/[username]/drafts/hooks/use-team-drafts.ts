import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getTeamDraftsPermissionHandler, listTeamDraftsHandler } from "@ratel/ts-bridges";
import type { TeamDraftPermission } from "@ratel/ts-bridges";
import { useCreatePost, useDeletePost } from "@ratel/ts-bridges/hooks";
import { useUserContext } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { useTeamDraftI18n } from "@/pages/[username]/drafts/i18n";
import { partitionId, useDraftsList, type DraftsList } from "./use-drafts-list";

// app/ratel/src/features/social/pages/draft/team/views/mod.rs (`Home`): the
// permission gate, the team drafts list, and the new-post / delete actions.

/**
 * The permission loader (mod.rs:32-38): the loader itself never fails — a
 * handler error becomes `Err(String)`, which renders the viewer page. Suspends
 * until it resolves.
 */
export function useTeamDraftsPermission(username: string): TeamDraftPermission | null {
  // The role depends on the session; re-resolve when it changes.
  const viewer = useUserContext().user?.pk ?? null;
  const query = useSuspenseQuery({
    queryKey: ["getTeamDraftsPermission", username, viewer],
    queryFn: () =>
      getTeamDraftsPermissionHandler(username).then(
        (data): TeamDraftPermission | null => data,
        () => null,
      ),
  });
  return query.data;
}

export interface UseTeamDrafts {
  drafts: DraftsList;
  /** `on_new_post` (mod.rs:68-86): create a team post, then open its editor; a failure is toasted. */
  createPost(): Promise<void>;
  /** `on_confirm_delete` (mod.rs:88-102): resolves `true` on success (toast + refresh), `false` after an error toast. */
  deleteDraft(pk: string): Promise<boolean>;
}

export function useTeamDrafts(username: string, teamPk: string): UseTeamDrafts {
  const navigate = useNavigate();
  const toast = useToast();
  const tr = useTeamDraftI18n();
  const drafts = useDraftsList(["listTeamDrafts", "infinite", username], (bookmark) =>
    listTeamDraftsHandler(username, bookmark),
  );
  const create = useCreatePost();
  const remove = useDeletePost();

  return {
    drafts,
    createPost: async () => {
      try {
        // `team_pk_str.parse::<TeamPartition>().ok()`
        const resp = await create.mutateAsync(teamPk === "" ? null : teamPk);
        navigate(`/posts/${partitionId(resp.post_pk)}/edit`);
      } catch (e) {
        toast.error(e);
      }
    },
    deleteDraft: async (pk) => {
      try {
        await remove.mutateAsync({ postId: pk, force: null });
      } catch (e) {
        toast.error(e);
        return false;
      }
      toast.info(tr.deleteSuccess);
      void drafts.refresh();
      return true;
    },
  };
}
