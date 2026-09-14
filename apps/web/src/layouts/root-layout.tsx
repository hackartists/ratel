import { useEffect } from "react";
import { Outlet } from "react-router-dom";

// Dioxus `RootLayout` (app/ratel/src/root_layout). Providers and the shell
// chrome move here in P1; no wrapper element until then.
export function Component() {
  // E2E readiness signal: effects run after the first client commit, when
  // React has attached event handlers. playwright/tests/utils.js waits on it.
  useEffect(() => {
    document.documentElement.dataset.appReady = "true";
  }, []);

  return <Outlet />;
}
