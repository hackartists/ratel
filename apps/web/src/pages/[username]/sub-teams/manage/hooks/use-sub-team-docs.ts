import { useSuspenseQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  deleteSubTeamDocHandler,
  listSubTeamDocsHandler,
  reorderSubTeamDocsHandler,
  updateSubTeamDocHandler,
} from "@ratel/ts-bridges";
import type { ListResponse, SubTeamDocumentResponse, UpdateSubTeamDocumentRequest } from "@ratel/ts-bridges";

// app/ratel/src/features/sub_team/hooks/use_sub_team_docs.rs — installed by
// `DocsTab`, so it (and its loader) lives only while the Documents tab is
// mounted. Every action restarts the docs loader. (`handle_create` is not
// used by the management page.)

export interface UseSubTeamDocs {
  docs: ListResponse<SubTeamDocumentResponse>;
  handleUpdate: (docId: string, req: UpdateSubTeamDocumentRequest) => void;
  handleDelete: (docId: string) => void;
  handleReorder: (docIds: string[]) => void;
}

/** `UpdateSubTeamDocumentRequest { ..Default::default() }`. */
export const EMPTY_DOC_UPDATE: UpdateSubTeamDocumentRequest = {
  title: null,
  body: null,
  required: null,
  order: null,
  attachments: null,
};

export function useSubTeamDocs(teamId: string): UseSubTeamDocs {
  const docs = useSuspenseQuery({
    queryKey: ["subTeamManage", "listSubTeamDocs", teamId],
    queryFn: () => listSubTeamDocsHandler(teamId),
  });
  const restart = docs.refetch;

  const run = useCallback(
    (label: string, fn: () => Promise<unknown>) => {
      void (async () => {
        try {
          await fn();
          await restart();
        } catch (e) {
          console.error(`${label} failed:`, e);
        }
      })();
    },
    [restart],
  );

  return {
    docs: docs.data,
    handleUpdate: (docId, req) => run("update_sub_team_doc", () => updateSubTeamDocHandler(teamId, docId, req)),
    handleDelete: (docId) => run("delete_sub_team_doc", () => deleteSubTeamDocHandler(teamId, docId)),
    handleReorder: (docIds) =>
      run("reorder_sub_team_docs", () => reorderSubTeamDocsHandler(teamId, { doc_ids: docIds })),
  };
}
