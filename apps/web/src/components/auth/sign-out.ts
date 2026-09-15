import { logoutHandler } from "@ratel/ts-bridges";

// app/ratel/src/features/auth/services/sign_out.rs `sign_out`: log out on the
// server (failure only logged), reset the user context, drop the persisted
// refresh token + cached session, then reload the page.

/** `restore_session::clear_refresh_token` + `persistent_state::clear_cached_session`. */
const PERSISTED_SESSION_KEYS = ["refresh_token", "user_context"];

export async function signOut(resetUserContext: () => void): Promise<void> {
  try {
    await logoutHandler();
  } catch (e) {
    console.error("logout_handler failed:", e);
  }
  resetUserContext();
  try {
    for (const key of PERSISTED_SESSION_KEYS) window.localStorage.removeItem(key);
  } catch {
    // Storage unavailable (private mode): nothing persisted to clear.
  }
  window.location.reload();
}
