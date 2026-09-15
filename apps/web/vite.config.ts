import { defineConfig, type Plugin, type ResolvedConfig } from "vite";
import react from "@vitejs/plugin-react";
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
// Side-effect import: augments vite's `UserConfig` with `ssgOptions`.
import "vite-react-ssg";
import { PRERENDERED_ROUTES } from "./src/prerendered-routes";

const here = dirname(fileURLToPath(import.meta.url));

// Resolve the CLI through Node module resolution, not `node_modules/.bin`:
// the repo's `.npmrc` sets `node-linker=hoisted`, so workspace deps live in
// the root `node_modules` and `apps/web/node_modules` never exists.
function tailwindCliEntry(): string {
  const require = createRequire(import.meta.url);
  const pkgPath = require.resolve("@tailwindcss/cli/package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { bin: string | Record<string, string> };
  const bin = typeof pkg.bin === "string" ? pkg.bin : pkg.bin.tailwindcss;
  return resolve(dirname(pkgPath), bin);
}

// Stylesheets and images served at `/assets/*` and copied into the build output.
const LEGACY_ASSETS = resolve(here, "assets");
const TAILWIND_INPUT = resolve(here, "src/styles/tailwind.css");
const TAILWIND_OUT = resolve(here, ".cache/tailwind.css");
const TAILWIND_CLI = tailwindCliEntry();
// Served (dev) and emitted (build) at stable, unhashed URLs.
const TAILWIND_URL = "/_ratel/tailwind.css";

// Page paths go to the React app; everything the Rust server owns is proxied.
// Defaults to dev, never prod.
const API_TARGET = process.env.VITE_API_TARGET ?? "https://dev.ratel.foundation";
// `/launchpad/return` is a page (LaunchpadReturnPage), so only the partner
// endpoints under `/launchpad` go to the server
// (app/ratel/src/features/launchpad_partner/server.rs).
const API_PREFIXES = ["/api", "/v3", "/mcp", "/hooks", "/launchpad/health", "/launchpad/points"];

const BASE = process.env.VITE_BASE ?? "/";
const IS_TAURI = process.env.VITE_TAURI === "1";

// Mirrors the former Dioxus app.rs: the Tauri shell disables pinch zoom so iOS
// WKWebView doesn't auto-zoom focused inputs; the browser keeps user zoom.
const VIEWPORT = IS_TAURI
  ? "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content"
  : "width=device-width, initial-scale=1.0, viewport-fit=cover, interactive-widget=resizes-content";

// Same elements, same order as the former Dioxus `App` head (app.rs).
// `main.css` has no @layer, and tailwind's unlayered globals only win because
// tailwind loads last — so this order is load-bearing and must not be left to
// Vite's CSS bundling.
function legacyHead(base: string): string {
  const a = (p: string) => `${base}assets/${p}`;
  return [
    `<link rel="icon" href="${a("favicon.ico")}" />`,
    `<link rel="preconnect" href="https://fonts.googleapis.com" />`,
    `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />`,
    `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Outfit:wght@300;400;500;600;700&display=swap" />`,
    `<link rel="stylesheet" href="${a("main.css")}" />`,
    `<link rel="stylesheet" href="${a("dx-components-theme.css")}" />`,
    `<script src="https://cdn.portone.io/v2/browser-sdk.js"></script>`,
    `<link rel="stylesheet" href="${base}${TAILWIND_URL.slice(1)}" />`,
  ].join("\n    ");
}

const MIME: Record<string, string> = {
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".lottie": "application/octet-stream",
};

function buildTailwind(): void {
  mkdirSync(dirname(TAILWIND_OUT), { recursive: true });
  execFileSync(process.execPath, [TAILWIND_CLI, "-i", TAILWIND_INPUT, "-o", TAILWIND_OUT], {
    stdio: "inherit",
  });
}

function ratelLegacyShell(): Plugin {
  let config: ResolvedConfig;
  let watcher: ChildProcess | undefined;
  return {
    name: "ratel-legacy-shell",
    configResolved(resolved) {
      config = resolved;
    },
    buildStart() {
      if (config.command === "build" && !config.build.ssr) buildTailwind();
    },
    configureServer(server) {
      mkdirSync(dirname(TAILWIND_OUT), { recursive: true });
      watcher = spawn(
        process.execPath,
        [TAILWIND_CLI, "-i", TAILWIND_INPUT, "-o", TAILWIND_OUT, "--watch"],
        { stdio: "inherit" },
      );
      server.httpServer?.once("close", () => watcher?.kill());
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? "").split("?")[0];
        let file: string | undefined;
        if (url === TAILWIND_URL) file = TAILWIND_OUT;
        else if (url.startsWith("/assets/")) file = join(LEGACY_ASSETS, url.slice("/assets/".length));
        if (!file || !file.startsWith(LEGACY_ASSETS) && file !== TAILWIND_OUT) return next();
        if (!existsSync(file) || !statSync(file).isFile()) return next();
        res.setHeader("Content-Type", MIME[extname(file)] ?? "application/octet-stream");
        res.end(readFileSync(file));
      });
    },
    transformIndexHtml: {
      order: "post",
      handler(html) {
        return html
          .replace("<!--ratel:viewport-->", `<meta name="viewport" content="${VIEWPORT}" />`)
          .replace("<!--ratel:head-->", legacyHead(config.base));
      },
    },
    closeBundle() {
      if (config.command !== "build" || config.build.ssr) return;
      const outDir = resolve(config.root, config.build.outDir);
      if (!existsSync(outDir)) return;
      cpSync(LEGACY_ASSETS, join(outDir, "assets"), {
        recursive: true,
        filter: (src) => !src.endsWith(".DS_Store"),
      });
      mkdirSync(join(outDir, "_ratel"), { recursive: true });
      cpSync(TAILWIND_OUT, join(outDir, TAILWIND_URL.slice(1)));
    },
  };
}

export default defineConfig({
  base: BASE,
  plugins: [react(), ratelLegacyShell()],
  resolve: {
    alias: { "@": resolve(here, "src") },
  },
  build: {
    // `assets/` is taken by the shared legacy files copied above.
    assetsDir: "_app",
  },
  server: {
    proxy: Object.fromEntries(
      API_PREFIXES.map((prefix) => [prefix, { target: API_TARGET, changeOrigin: true, secure: true }]),
    ),
  },
  ssgOptions: {
    rootContainerId: "main",
    script: "defer",
    beastiesOptions: false,
    // main.tsx hydrates exactly these paths and client-renders the rest.
    includedRoutes: () => [...PRERENDERED_ROUTES],
  },
});
