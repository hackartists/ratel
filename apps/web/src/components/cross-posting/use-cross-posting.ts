import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ConnectionResponse, SocialPlatform } from "@ratel/ts-bridges";
import {
  useConnectBluesky,
  useConnectLinkedinInit,
  useDisconnect,
  useListConnections,
  useToggleAutoPost,
} from "@ratel/ts-bridges/hooks";
import { useAuth } from "@/lib/auth";

// app/ratel/src/features/cross_posting/hooks/use_cross_posting.rs
// (`UseCrossPosting`). The Rust hook is a provider/consumer pair cached in
// Dioxus context so post-edit and the Settings → Connections page share one
// instance; React's per-mount hook call plus react-query's cache gives every
// caller the same server truth without a context indirection, so there is
// only one `useCrossPosting()` here.

export interface UseCrossPosting {
  connections: ConnectionResponse[];
  connectionsLoading: boolean;
  connectedCount: number;
  /** Compose-time per-post platform toggle map (not persisted — publish-time only). */
  perPostEnabled: Partial<Record<SocialPlatform, boolean>>;
  setPerPostEnabled: (platform: SocialPlatform, enabled: boolean) => void;
  /** Count of platforms currently toggled on in `perPostEnabled`. */
  reachCount: number;
  connectBluesky: (handle: string, appPassword: string) => Promise<void>;
  toggleAutoPost: (platform: SocialPlatform, enabled: boolean) => Promise<void>;
  disconnect: (platform: SocialPlatform) => Promise<void>;
  /** Mints the LinkedIn authorize URL and leaves the SPA for it. */
  connectLinkedin: (returnTo: string | null) => Promise<void>;
}

const CONNECTIONS_KEY = "listConnections";

export function useCrossPosting(): UseCrossPosting {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const loggedIn = auth.loggedIn;

  const connectionsQuery = useListConnections({ enabled: loggedIn });
  const connections = loggedIn ? connectionsQuery.data ?? [] : [];

  const [perPostEnabled, setPerPostEnabledState] = useState<Partial<Record<SocialPlatform, boolean>>>({});

  const connectBlueskyMutation = useConnectBluesky();
  const toggleAutoPostMutation = useToggleAutoPost();
  const disconnectMutation = useDisconnect();
  const linkedinInitMutation = useConnectLinkedinInit();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [CONNECTIONS_KEY] });

  const connectedCount = useMemo(
    () => connections.filter((c) => c.status === "connected").length,
    [connections],
  );
  const reachCount = useMemo(() => Object.values(perPostEnabled).filter(Boolean).length, [perPostEnabled]);

  return {
    connections,
    connectionsLoading: loggedIn && connectionsQuery.isPending,
    connectedCount,
    perPostEnabled,
    setPerPostEnabled: (platform, enabled) =>
      setPerPostEnabledState((prev) => ({ ...prev, [platform]: enabled })),
    reachCount,
    connectBluesky: async (handle, appPassword) => {
      await connectBlueskyMutation.mutateAsync({ handle, app_password: appPassword });
      await invalidate();
    },
    toggleAutoPost: async (platform, enabled) => {
      await toggleAutoPostMutation.mutateAsync({ platform, req: { auto_post_enabled: enabled } });
      await invalidate();
    },
    disconnect: async (platform) => {
      await disconnectMutation.mutateAsync(platform);
      await invalidate();
    },
    connectLinkedin: async (returnTo) => {
      const resp = await linkedinInitMutation.mutateAsync({ return_to: returnTo });
      if (resp.authorize_url.length > 0) window.location.href = resp.authorize_url;
    },
  };
}
