import { useSuspenseQuery } from "@tanstack/react-query";
import {
  connectBlueskyHandler,
  connectLinkedinInitHandler,
  disconnectHandler,
  getMeHandler,
  listConnectionsHandler,
  toggleAutoPostHandler,
} from "@ratel/ts-bridges";
import type { ConnectionResponse, LinkedInOauthInitRequest, SocialPlatform } from "@ratel/ts-bridges";
import { useAuth } from "@/lib/auth";
import { redirectToExternal } from "./redirect";

// app/ratel/src/features/cross_posting/hooks/use_cross_posting.rs — the
// Settings → Connections controller: the connections loader, the header
// stats, and the connect / disconnect / auto-post mutations. Every mutation
// refetches the loader on success (Rust `self.connections.restart()`); the
// already-rendered list stays on screen while it reloads. Mutations throw
// the API error so the page decides the UX (`toast.error(e)`).

export type { ConnectionResponse, SocialPlatform } from "@ratel/ts-bridges";

export interface UseCrossPosting {
  connections: ConnectionResponse[];
  /** Rows in `connected` state (header "Connected" stat). */
  connectedCount: number;
  /** "This month" stat. Phase 1 placeholder, always 0 (use_cross_posting.rs:323). */
  postsThisMonth: number;
  connectBluesky: (handle: string, appPassword: string) => Promise<void>;
  toggleAutoPost: (platform: SocialPlatform, enabled: boolean) => Promise<void>;
  disconnect: (platform: SocialPlatform) => Promise<void>;
  /** Mints the LinkedIn authorize URL and leaves the SPA for it. */
  connectLinkedin: (returnTo: string | null) => Promise<void>;
}

/** Suspends until the connections resolve; a load failure reaches the error boundary. */
export function useCrossPosting(): UseCrossPosting {
  // Rust reads `use_user_context()().is_logged_in()` and returns an empty
  // list for signed-out visitors without calling the API. The Dioxus user
  // context is resolved before the page renders, so wait on the same
  // `["getMe"]` query the AuthProvider runs: otherwise the first paint would
  // use the signed-out key and re-suspend when the session arrives (React
  // then leaves `style=""` on the already-shown elements).
  useSuspenseQuery({ queryKey: ["getMe"], queryFn: () => getMeHandler() });
  const { loggedIn } = useAuth();
  const connections = useSuspenseQuery({
    queryKey: ["listConnections", loggedIn],
    queryFn: () => (loggedIn ? listConnectionsHandler() : Promise.resolve<ConnectionResponse[]>([])),
  });

  const refetch = async () => {
    await connections.refetch();
  };

  return {
    connections: connections.data,
    connectedCount: connections.data.filter((c) => c.status === "connected").length,
    postsThisMonth: 0,
    connectBluesky: async (handle, appPassword) => {
      await connectBlueskyHandler({ handle, app_password: appPassword });
      void refetch();
    },
    toggleAutoPost: async (platform, enabled) => {
      await toggleAutoPostHandler(platform, { auto_post_enabled: enabled });
      void refetch();
    },
    disconnect: async (platform) => {
      await disconnectHandler(platform);
      void refetch();
    },
    connectLinkedin: async (returnTo) => {
      // Rust `#[serde(skip_serializing_if = "Option::is_none")]` omits the key
      // (`{"req":{}}`); the generated type marks it required, so cast the empty body.
      const req = returnTo === null ? ({} as LinkedInOauthInitRequest) : { return_to: returnTo };
      const resp = await connectLinkedinInitHandler(req);
      redirectToExternal(resp.authorize_url);
    },
  };
}
