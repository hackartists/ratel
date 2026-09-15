import { useQueryClient } from "@tanstack/react-query";
import type { ConnectionResponse, FeedPartition, SocialPlatform, SyndicationPanelResponse } from "@ratel/ts-bridges";
import { useGetSyndicationPanel, useListConnections, useRetryJob } from "@ratel/ts-bridges/hooks";

// app/ratel/src/features/cross_posting/hooks/use_syndication_panel.rs
// (`UseSyndicationPanel`). Both loaders swallow errors (author-gated 403s,
// network) into an empty/`null` result so the panel renders a "not
// connected"/blank state instead of failing the whole post-detail tree —
// react-query's `retry: false` plus a `.catch` inside the query function
// gives the same shape.

export interface UseSyndicationPanel {
  panel: SyndicationPanelResponse | null;
  panelLoading: boolean;
  connections: ConnectionResponse[];
  retry: (platform: SocialPlatform) => Promise<void>;
  refresh: () => void;
}

export function useSyndicationPanel(postId: FeedPartition): UseSyndicationPanel {
  const queryClient = useQueryClient();

  const panelQuery = useGetSyndicationPanel(postId, { retry: false });
  const connectionsQuery = useListConnections({ retry: false });
  const retryMutation = useRetryJob();

  return {
    panel: panelQuery.data ?? null,
    panelLoading: panelQuery.isPending,
    connections: connectionsQuery.data ?? [],
    retry: async (platform) => {
      await retryMutation.mutateAsync({ postId, platform });
      await queryClient.invalidateQueries({ queryKey: ["getSyndicationPanel", postId] });
    },
    refresh: () => {
      void queryClient.invalidateQueries({ queryKey: ["getSyndicationPanel", postId] });
      void queryClient.invalidateQueries({ queryKey: ["listConnections"] });
    },
  };
}
