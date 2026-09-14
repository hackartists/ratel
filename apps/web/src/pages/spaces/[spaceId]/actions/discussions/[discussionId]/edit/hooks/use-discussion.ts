import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createContext, useContext, useState } from "react";
import { getDiscussionDetail } from "@ratel/ts-bridges";
import type { DiscussionResponse } from "@ratel/ts-bridges";

// discussion/context.rs (`Context::init`) — the discussion loader plus the
// "Import from overview" request counter the topbar button bumps.

export interface UseDiscussion {
  spaceId: string;
  discussionId: string;
  discussion: DiscussionResponse;
  refresh: () => void;
  importRequest: number;
  requestImport: () => void;
}

const DiscussionContext = createContext<UseDiscussion | null>(null);
export const DiscussionProvider = DiscussionContext.Provider;

export function useDiscussion(): UseDiscussion {
  const ctx = useContext(DiscussionContext);
  if (!ctx) throw new Error("useDiscussion must be used under DiscussionProvider");
  return ctx;
}

export function useDiscussionProvider(spaceId: string, discussionId: string): UseDiscussion {
  const queryClient = useQueryClient();
  const queryKey = ["getDiscussionDetail", spaceId, discussionId];
  const discussion = useSuspenseQuery({ queryKey, queryFn: () => getDiscussionDetail(spaceId, discussionId) }).data;
  const [importRequest, setImportRequest] = useState(0);

  return {
    spaceId,
    discussionId,
    discussion,
    refresh: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
    importRequest,
    requestImport: () => setImportRequest((v) => v + 1),
  };
}
