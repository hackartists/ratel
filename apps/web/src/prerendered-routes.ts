// Routes vite-react-ssg prerenders at build time. Shared by vite.config.ts
// (`ssgOptions.includedRoutes`) and main.tsx, which hydrates only these paths:
// every other URL is served the same static HTML, so it must be rendered from
// scratch on the client instead of hydrated against another page's markup.
// Keep this file free of `@/` imports (vite.config.ts loads it directly).
export const PRERENDERED_ROUTES: readonly string[] = ["/"];
