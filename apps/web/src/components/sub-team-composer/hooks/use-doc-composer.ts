import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { findTeamHandler, listSubTeamDocsHandler } from "@ratel/ts-bridges";
import type { CreateSubTeamDocumentRequest, SubTeamDocumentResponse, UpdateSubTeamDocumentRequest } from "@ratel/ts-bridges";
import { useCreateSubTeamDoc, useUpdateSubTeamDoc } from "@ratel/ts-bridges/hooks";
import { toTeamId } from "../utils";

// Controller for the sub-team document composer (new + edit), mirroring
// app/ratel/src/features/sub_team/hooks/use_sub_team_doc_compose.rs plus the
// team lookup from `render_compose` in
// app/ratel/src/features/sub_team/pages/doc_compose/component.rs.
//
// When `docId` is undefined the doc is `null` (creating a new document);
// when set, this walks the team's doc list and finds the matching row —
// same approach as the Rust loader (there is no single-doc GET endpoint).

export interface UseDocComposer {
  teamId: string;
  teamDisplay: string;
  teamHandle: string;
  doc: SubTeamDocumentResponse | null;
  saveNew: (body: CreateSubTeamDocumentRequest) => Promise<string>;
  saveExisting: (docId: string, body: UpdateSubTeamDocumentRequest) => Promise<void>;
}

export function useDocComposer(username: string, docId: string | undefined): UseDocComposer {
  // Every route that uses this composer is declared OUTSIDE SocialLayout in
  // both apps (route.rs: doc-edit/announcements-compose/bylaws-compose are
  // full-screen pages before `#[layout(SocialLayout)]`; route-tree.ts
  // mirrors it) — no shared wall/team context is mounted here, so Rust also
  // loads the team locally via `find_team_handler`.
  const team = useSuspenseQuery({
    queryKey: ["findTeam", username],
    queryFn: () => findTeamHandler(username),
  }).data;
  const teamId = toTeamId(team.pk);

  const doc = useSuspenseQuery({
    queryKey: ["subTeamDocCompose", teamId, docId],
    queryFn: async () => {
      if (!docId) return null;
      const list = await listSubTeamDocsHandler(teamId);
      return list.items.find((d) => d.id === docId) ?? null;
    },
  }).data;

  const createMutation = useCreateSubTeamDoc();
  const updateMutation = useUpdateSubTeamDoc();
  const queryClient = useQueryClient();

  // Rust reloads the docs list when the management page mounts again; drop the
  // cached list (and this composer's snapshot) so the next visit refetches.
  const invalidateDocs = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["subTeamManage", "listSubTeamDocs", teamId] }),
      queryClient.invalidateQueries({ queryKey: ["subTeamDocCompose", teamId] }),
    ]);

  return {
    teamId,
    teamDisplay: team.nickname || team.username,
    teamHandle: team.username,
    doc,
    saveNew: async (body) => {
      const created = await createMutation.mutateAsync({ teamPk: teamId, body });
      await invalidateDocs();
      return created.id;
    },
    saveExisting: async (id, body) => {
      await updateMutation.mutateAsync({ teamPk: teamId, docId: id, body });
      await invalidateDocs();
    },
  };
}
