import * as React from "react";
import { usePopup } from "@/lib/popup";
import { LoginModal } from "./login-modal";

/**
 * The popup title every Rust caller passes: `popup.open(rsx! { LoginModal {..} })
 * .with_title("Start building your Essence")` (components/arena_topbar/component.rs:50,
 * views/index/component.rs:384, features/auth/types/authorized_navigator.rs:24).
 * Rust hardcodes it outside `translate!`, so there is no generated i18n key;
 * it stays English in both languages, like the Dioxus app.
 */
export const LOGIN_MODAL_TITLE = "Start building your Essence";

export interface OpenLoginModalOptions {
  /** Popup title (default {@link LOGIN_MODAL_TITLE}). */
  title?: string;
  /** Runs after the login or sign-up succeeded and the user context is set. */
  onSuccess?: () => void;
  /** Forwarded to {@link LoginModal}'s `defaultLoginMethod` prop. */
  defaultLoginMethod?: "email" | "phone";
}

export interface LoginModalService {
  open(options?: OpenLoginModalOptions): void;
}

/** Opens `LoginModal` in the app popup for a signed-out user. */
export function useLoginModal(): LoginModalService {
  const popup = usePopup();
  return React.useMemo(
    () => ({
      open: ({ title = LOGIN_MODAL_TITLE, onSuccess, defaultLoginMethod } = {}) =>
        popup.open(<LoginModal onSuccess={onSuccess} defaultLoginMethod={defaultLoginMethod} />, { title }),
    }),
    [popup],
  );
}
