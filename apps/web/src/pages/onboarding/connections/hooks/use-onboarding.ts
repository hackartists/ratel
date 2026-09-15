import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { listConnectionsHandler } from "@ratel/ts-bridges";
import type { ConnectionResponse } from "@ratel/ts-bridges";
import { useConnectBluesky, useConnectLinkedinInit, useMarkOnboardingSeen } from "@ratel/ts-bridges/hooks";
import { useAuth } from "@/lib/auth";

// The onboarding interstitial's controller: the connections loader from
// `UseCrossPosting` (app/ratel/src/features/cross_posting/hooks/use_cross_posting.rs)
// plus `mark_onboarding_seen_handler` from
// app/ratel/src/features/cross_posting/views/onboarding_page/component.rs.

export type { ConnectionResponse } from "@ratel/ts-bridges";

const CONNECTIONS_KEY = "listConnections";

export interface UseOnboarding {
  connections: ConnectionResponse[];
  /** Flip `User.interstitial_seen` and store the updated user. Throws on failure. */
  markSeen: () => Promise<void>;
  /** Bluesky app-password connect; reloads the connections on success. Throws on failure. */
  connectBluesky: (handle: string, appPassword: string) => Promise<void>;
  /** Mint the LinkedIn authorize URL and leave the SPA for it. Throws on failure. */
  connectLinkedin: (returnTo: string | null) => Promise<void>;
}

/** Suspends until the connections load (an empty list, without a request, when signed out). */
export function useOnboarding(): UseOnboarding {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const loggedIn = auth.loggedIn;

  const connections = useSuspenseQuery({
    queryKey: [CONNECTIONS_KEY, loggedIn],
    queryFn: () => (loggedIn ? listConnectionsHandler() : Promise.resolve<ConnectionResponse[]>([])),
  });
  const markSeenMutation = useMarkOnboardingSeen();
  const connectBlueskyMutation = useConnectBluesky();
  const linkedinInitMutation = useConnectLinkedinInit();

  return {
    connections: connections.data,
    markSeen: async () => {
      const user = await markSeenMutation.mutateAsync();
      auth.setUserContext({ ...auth.userContext, user });
    },
    connectBluesky: async (handle, appPassword) => {
      await connectBlueskyMutation.mutateAsync({ handle, app_password: appPassword });
      await queryClient.invalidateQueries({ queryKey: [CONNECTIONS_KEY] });
    },
    connectLinkedin: async (returnTo) => {
      const resp = await linkedinInitMutation.mutateAsync({ return_to: returnTo });
      // `redirect_to_external` (cross_posting/interop/redirect.rs): a full
      // top-level navigation to LinkedIn's consent page.
      if (resp.authorize_url.length > 0) window.location.href = resp.authorize_url;
    },
  };
}
