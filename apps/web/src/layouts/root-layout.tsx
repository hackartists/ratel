import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { applyPersistedLanguage } from "@/i18n";
import { PopupProvider, PopupZone } from "@/lib/popup";
import { createQueryClient } from "@/lib/query-client";
import { ThemeProvider } from "@/lib/theme";
import { ToastProvider, ToastZone } from "@/lib/toast";

// Dioxus `App` services (PopupService, ToastService in app/ratel/src/app.rs)
// plus `RootLayout` (app/ratel/src/root_layout.rs): the route outlet, then the
// popup zone, then the toast stack — same sibling order. Providers render no
// DOM. Auth/team contexts, the error boundary and notification bootstrap move
// here with P1.
export function Component() {
  // Created once per page load (per render root during prerendering).
  const [queryClient] = useState(createQueryClient);

  useEffect(() => {
    // Prerendered HTML is English; switch after hydration so it matches.
    applyPersistedLanguage();
    // E2E readiness signal: effects run after the first client commit, when
    // React has attached event handlers. playwright/tests/utils.js waits on it.
    document.documentElement.dataset.appReady = "true";
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <PopupProvider>
          <ToastProvider>
            <Outlet />
            <PopupZone />
            <ToastZone />
          </ToastProvider>
        </PopupProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
