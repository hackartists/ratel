import * as React from "react";
import { useNavigate } from "react-router-dom";
import { listUserDraftsHandler } from "@ratel/ts-bridges";
import { useCreatePost, useDeletePost } from "@ratel/ts-bridges/hooks";
import { useUserContext } from "@/lib/auth";
import { partitionId, useDraftsList, type DraftsList } from "./use-drafts-list";

// app/ratel/src/features/social/pages/draft/user/views/mod.rs (`Home`): the
// signed-in user's drafts (`use_infinite_query` over `list_user_drafts_handler`),
// the locally deleted set, and the create / delete actions.

export interface UseUserDrafts {
  drafts: DraftsList;
  /** `deleted: Signal<HashSet<String>>` — pks removed on this page. */
  deleted: ReadonlySet<string>;
  /** `go_create_post` (mod.rs:91-104): create a post, then open its editor; a failure is only logged. */
  createPost(): Promise<void>;
  /** "Delete draft" (mod.rs:716-728): delete immediately, hide the card on success. */
  deleteDraft(pk: string): Promise<void>;
}

export function useUserDrafts(): UseUserDrafts {
  const navigate = useNavigate();
  // `list_user_drafts_handler` lists the session user's drafts — key the cache
  // by viewer so a sign-in/out never shows another user's list.
  const viewer = useUserContext().user?.pk ?? null;
  const drafts = useDraftsList(["listUserDrafts", "infinite", viewer], (bookmark) =>
    listUserDraftsHandler(bookmark),
  );
  const [deleted, setDeleted] = React.useState<ReadonlySet<string>>(() => new Set());
  const create = useCreatePost();
  const remove = useDeletePost();

  return {
    drafts,
    deleted,
    createPost: async () => {
      try {
        const resp = await create.mutateAsync(null);
        navigate(`/posts/${partitionId(resp.post_pk)}/edit`);
      } catch (e) {
        console.error("Failed to create post:", e);
      }
    },
    deleteDraft: async (pk) => {
      try {
        await remove.mutateAsync({ postId: pk, force: null });
        setDeleted((prev) => new Set(prev).add(pk));
      } catch {
        // Rust ignores a failed delete (mod.rs:724).
      }
    },
  };
}
