// app/ratel/src/features/auth/context (AuthContext + UserContext) and its hooks
// (`use_auth_context`, `use_user_context`, `use_user_membership`).
//
// The signed-in user comes from `GET /api/auth/me` once per page load; any
// failure reads as signed out, like the Rust loader. Components consume
// `useAuth()` / `useUserContext()` and never call the handler directly.
import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMeHandler, isTauri } from "@ratel/ts-bridges";
import { tryRestoreSession } from "@/components/auth/interop";
import type { User } from "@ratel/ts-bridges";
import type { UserMembershipResponse } from "@ratel/ts-bridges";
import { getMembershipHandlerGetV3MeMemberships } from "@ratel/ts-bridges";

/** Rust `UserContext`. `refreshToken` is only set by the mobile restore path. */
export interface UserContext {
  user: User | null;
  refreshToken: string | null;
  membership: UserMembershipResponse | null;
}

const SIGNED_OUT: UserContext = { user: null, refreshToken: null, membership: null };

export interface AuthService {
  /** False until `/api/auth/me` has answered (the Rust loader suspends until then). */
  ready: boolean;
  userContext: UserContext;
  loggedIn: boolean;
  /** Replace the context after sign-in, sign-up or account changes. */
  setUserContext(next: UserContext): void;
  /** Back to signed out (sign-out, dead session). */
  reset(): void;
  /** Re-fetch `/api/auth/me`. */
  refresh(): Promise<void>;
}

const AuthContext = React.createContext<AuthService | null>(null);

/** `["getMe"]` — the scaffolded `useGetMe` query key. */
const ME_KEY = ["getMe"] as const;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const me = useQuery({
    queryKey: ME_KEY,
    queryFn: async () => {
      // Rust `AuthContext::init`: on the native shell the `api_request` cookie
      // jar is process-lifetime only, so exchange the cached refresh token for
      // a fresh session BEFORE the first authenticated call. No-op when
      // nothing is cached.
      if (isTauri()) await tryRestoreSession();
      return getMeHandler();
    },
    retry: false,
    staleTime: Infinity,
  });
  const [override, setOverride] = React.useState<UserContext | null>(null);

  const fromServer: UserContext = me.data
    ? { user: me.data.user ?? null, refreshToken: null, membership: me.data.membership ?? null }
    : SIGNED_OUT;
  const userContext = override ?? fromServer;

  const service = React.useMemo<AuthService>(
    () => ({
      ready: !me.isPending,
      userContext,
      loggedIn: userContext.user !== null,
      setUserContext: (next) => setOverride(next),
      reset: () => {
        setOverride(SIGNED_OUT);
        queryClient.setQueryData(ME_KEY, { user: null, membership: null });
      },
      refresh: async () => {
        setOverride(null);
        await queryClient.invalidateQueries({ queryKey: ME_KEY });
      },
    }),
    [me.isPending, userContext, queryClient],
  );

  return <AuthContext.Provider value={service}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthService {
  const service = React.useContext(AuthContext);
  if (!service) throw new Error("useAuth must be used inside AuthProvider");
  return service;
}

/** Rust `use_user_context()`. */
export function useUserContext(): UserContext {
  return useAuth().userContext;
}

/**
 * Rust `use_user_membership()`: the signed-in user's membership, fetched once
 * when `/api/auth/me` didn't include it.
 */
export function useUserMembership(): UserMembershipResponse | null {
  const auth = useAuth();
  const { user, membership } = auth.userContext;
  const needsFetch = user !== null && membership === null;
  const setUserContext = auth.setUserContext;
  const userContext = auth.userContext;

  React.useEffect(() => {
    if (!needsFetch) return;
    let cancelled = false;
    getMembershipHandlerGetV3MeMemberships()
      .then((resp) => {
        if (!cancelled) setUserContext({ ...userContext, membership: resp });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [needsFetch, setUserContext, userContext]);

  return membership;
}
