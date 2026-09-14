import { isTauri, setBaseUrl } from "@ratel/ts-bridges/runtime";
import { createRoot as createDomRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { createBrowserRouter, RouterProvider, type RouteObject } from "react-router-dom";
import { ViteReactSSG } from "vite-react-ssg";
import { routes } from "@/App";
import { initI18n } from "@/i18n";
import { installViewportTracking } from "@/lib/viewport";
import { PRERENDERED_ROUTES } from "@/prerendered-routes";

// React Router basename from Vite's `base` ("/" collapses to "").
const ROUTER_BASENAME = import.meta.env.BASE_URL.replace(/\/$/, "");
// `main.css` sizes `#main`, so the app mounts where the Dioxus app did.
const ROOT_CONTAINER = "#main";

// Same default as the Dioxus Tauri build (`api_base_url()` in
// app/ratel/src/common/fullstack/tauri_web/server_fn.rs).
const MOBILE_API_URL = import.meta.env.VITE_MOBILE_API_URL ?? "https://dev.ratel.foundation";

function setup(isClient: boolean): void {
  initI18n(isClient);
  if (!isClient) return;
  // The WebView origin (tauri://localhost) isn't the API; the browser build
  // stays same-origin.
  if (isTauri()) setBaseUrl(MOBILE_API_URL);
  installViewportTracking();
}

/** Whether the current URL was prerendered, i.e. its static HTML is this page's markup. */
function isPrerenderedLocation(): boolean {
  let path = window.location.pathname;
  if (ROUTER_BASENAME && path.startsWith(ROUTER_BASENAME)) path = path.slice(ROUTER_BASENAME.length);
  const normalized = `/${path.replace(/^\/+|\/+$/g, "")}`;
  return PRERENDERED_ROUTES.includes(normalized);
}

/**
 * Client-only mount for URLs that weren't prerendered. vite-react-ssg always
 * hydrates in production, and hydrating a space page against the landing
 * page's static HTML throws hydration errors and re-renders anyway.
 */
function renderClientOnly(): void {
  setup(true);
  const container = document.querySelector(ROOT_CONTAINER);
  if (!container) return;
  container.removeAttribute("data-server-rendered");
  const router = createBrowserRouter(routes as RouteObject[], { basename: ROUTER_BASENAME || "/" });
  // Same tree as vite-react-ssg's client (no StrictMode), so both paths behave alike.
  createDomRoot(container).render(
    <HelmetProvider>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </HelmetProvider>,
  );
}

const hydrateWithSsg = typeof window === "undefined" || isPrerenderedLocation();
if (!hydrateWithSsg) renderClientOnly();

// The SSG build imports `createRoot` to prerender PRERENDERED_ROUTES.
export const createRoot = hydrateWithSsg
  ? ViteReactSSG({ routes, basename: ROUTER_BASENAME }, ({ isClient }) => setup(isClient), {
      rootContainer: ROOT_CONTAINER,
    })
  : undefined;
