import { ViteReactSSG } from "vite-react-ssg";
import { routes } from "@/App";
import { initI18n } from "@/i18n";
import { installViewportTracking } from "@/lib/viewport";

// React Router basename from Vite's `base` ("/" collapses to "").
const ROUTER_BASENAME = import.meta.env.BASE_URL.replace(/\/$/, "");

export const createRoot = ViteReactSSG(
  { routes, basename: ROUTER_BASENAME },
  ({ isClient }) => {
    initI18n(isClient);
    if (isClient) installViewportTracking();
  },
  // `main.css` sizes `#main`, so the app mounts where the Dioxus app did.
  { rootContainer: "#main" },
);
