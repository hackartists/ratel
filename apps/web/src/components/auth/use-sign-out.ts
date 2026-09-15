import { useCallback } from "react";
import { useLogout } from "@ratel/ts-bridges/hooks";
import { useAuth } from "@/lib/auth";

// app/ratel/src/features/auth/services/sign_out.rs — `sign_out(user_ctx)`:
// `logout_handler` (a failure is only logged), reset the user context, drop
// the persisted restore-session state, then reload the page.

/** `REFRESH_TOKEN_STORAGE_KEY` (features/auth/services/restore_session.rs:22). */
const REFRESH_TOKEN_STORAGE_KEY = "refresh_token";
/** `USER_CONTEXT_STORAGE_KEY` (common/services/persistent_state.rs:22). */
const USER_CONTEXT_STORAGE_KEY = "user_context";

function removeStored(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // storage unavailable: nothing persisted
  }
}

export function useSignOut(): () => Promise<void> {
  const auth = useAuth();
  const logout = useLogout();
  const reset = auth.reset;
  const mutateAsync = logout.mutateAsync;

  return useCallback(async () => {
    try {
      await mutateAsync();
    } catch (e) {
      console.error(`logout_handler failed: ${String(e)}`);
    }
    reset();
    removeStored(REFRESH_TOKEN_STORAGE_KEY);
    removeStored(USER_CONTEXT_STORAGE_KEY);
    window.location.reload();
  }, [mutateAsync, reset]);
}
