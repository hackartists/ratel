import { QueryClientProvider } from "@tanstack/react-query";
import { Suspense, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { ErrorBoundary } from "@/components/error-page";
import { NotificationsProvider } from "@/components/notifications";
import { applyPersistedLanguage } from "@/i18n";
import { AuthProvider, useAuth } from "@/lib/auth";
import { PopupProvider, PopupZone } from "@/lib/popup";
import { createQueryClient } from "@/lib/query-client";
import { ThemeProvider } from "@/lib/theme";
import { ToastProvider, ToastZone } from "@/lib/toast";

// Dioxus `App` services (PopupService, ToastService, ThemeService in
// app/ratel/src/app.rs) plus `RootLayout` (app/ratel/src/root_layout.rs):
// AuthContext, then the route outlet under ErrorBoundary > SuspenseBoundary,
// then the popup zone and the toast stack — same sibling order. Providers
// render no DOM, including the notification bootstrap around the outlet.
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
            <AuthProvider>
              <RouteOutlet />
              <PopupZone />
              <ToastZone />
            </AuthProvider>
          </ToastProvider>
        </PopupProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function RouteOutlet() {
  const auth = useAuth();
  return (
    // A session error on the error page signs the user out before navigating
    // (Rust ErrorPage resets UserContext).
    <ErrorBoundary onAuthError={auth.reset}>
      <Suspense fallback={null}>
        {/* Rust `SuspenseBoundary { NotificationsBootstrap {} }`: the notification
            controllers and push wiring wrap the outlet for every route. */}
        <NotificationsProvider>
          <Outlet />
        </NotificationsProvider>
      </Suspense>
    </ErrorBoundary>
  );
}
