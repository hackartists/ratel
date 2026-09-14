import { isTauri, setBaseUrl } from "@ratel/ts-bridges/runtime";
import { ViteReactSSG } from "vite-react-ssg";
import { routes } from "@/App";
import { initI18n } from "@/i18n";
import { installViewportTracking } from "@/lib/viewport";

// React Router basename from Vite's `base` ("/" collapses to "").
const ROUTER_BASENAME = import.meta.env.BASE_URL.replace(/\/$/, "");

// Same default as the Dioxus Tauri build (`api_base_url()` in
// app/ratel/src/common/fullstack/tauri_web/server_fn.rs).
const MOBILE_API_URL = import.meta.env.VITE_MOBILE_API_URL ?? "https://dev.ratel.foundation";

export const createRoot = ViteReactSSG(
  { routes, basename: ROUTER_BASENAME },
  ({ isClient }) => {
    initI18n(isClient);
    if (!isClient) return;
    // The WebView origin (tauri://localhost) isn't the API; the browser build
    // stays same-origin.
    if (isTauri()) setBaseUrl(MOBILE_API_URL);
    installViewportTracking();
  },
  // `main.css` sizes `#main`, so the app mounts where the Dioxus app did.
  { rootContainer: "#main" },
);
