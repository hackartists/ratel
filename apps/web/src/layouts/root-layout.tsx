import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { applyPersistedLanguage } from "@/i18n";
import { createQueryClient } from "@/lib/query-client";

// Dioxus `RootLayout` (app/ratel/src/root_layout). Providers and the shell
// chrome move here in P1; no wrapper element until then.
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

  // Providers render no DOM, so the tree under #main matches the Dioxus app.
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
