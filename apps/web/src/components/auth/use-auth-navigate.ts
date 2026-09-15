import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { User } from "@ratel/ts-bridges";
import { useAuth } from "@/lib/auth";
import { LOGIN_MODAL_TITLE, useLoginModal } from "./use-login-modal";

// app/ratel/src/features/auth/types/authorized_navigator.rs — `nav.auth_push(route)`:
// navigate when signed in; otherwise open `LoginModal` (title "Start building
// your Essence") whose `on_success` pushes the route.
//
// A target can depend on the user (`Route::SocialDraft { username }`). Rust
// captures the username at click time, which is empty for a signed-out click,
// so its post-login push goes to `//drafts`. Here the target is built from the
// user that just signed in, once the user context holds them.

export type AuthNavigateTarget = string | ((user: User) => string);

export function useAuthNavigate(): (to: AuthNavigateTarget) => void {
  const { userContext } = useAuth();
  const user = userContext.user;
  const navigate = useNavigate();
  const loginModal = useLoginModal();
  const [pending, setPending] = useState<((user: User) => string) | null>(null);

  useEffect(() => {
    if (pending === null || user === null) return;
    setPending(null);
    navigate(pending(user));
  }, [pending, user, navigate]);

  return useCallback(
    (to: AuthNavigateTarget) => {
      const build = typeof to === "string" ? () => to : to;
      if (user !== null) {
        navigate(build(user));
        return;
      }
      loginModal.open({ title: LOGIN_MODAL_TITLE, onSuccess: () => setPending(() => build) });
    },
    [user, navigate, loginModal],
  );
}
