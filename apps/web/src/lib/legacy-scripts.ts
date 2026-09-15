import { useEffect } from "react";

// Page scripts from the Dioxus app, loaded unmodified
// (docs/superpower/2026-09-14-react-frontend-migration.md §3.4.2).
//
// A Dioxus page loads its script with
// `document::Script { defer: true, src: asset!("./script.js") }`. The React
// page imports the SAME file straight from `app/ratel/src/...` with
// `?url&no-inline`, so there is no copy that can drift:
//
//   import essenceScript from "../legacy-scripts/features/essence/pages/sources/script.js?url&no-inline";
//   useLegacyScript(essenceScript);
//
//   - `?url` makes Vite hand back a URL instead of bundling the file: in dev it
//     is served from its source path (inside the pnpm workspace root, which
//     Vite's default `server.fs.allow` already permits); in a build it is
//     emitted byte-for-byte as a hashed asset.
//   - `&no-inline` stops Vite from turning small files into `data:` URLs
//     (`build.assetsInlineLimit`), so every script keeps a real URL, like
//     `asset!()` gives it.
//
// The script is appended to `<head>` once per page load and never removed,
// however often the page re-renders, unmounts or remounts. That is what the
// scripts expect: they install document listeners and a MutationObserver and
// guard re-initialisation themselves (`document.body.dataset.*Bound`), exactly
// as they did under Dioxus' client-side navigation.
//
// `defer` is kept for parity, but a script inserted from JS is always
// asynchronous; what `defer` guaranteed under Dioxus (the page DOM exists when
// the script runs) holds because the insert happens in an effect, after the
// page has committed.

const loaded = new Set<string>();

/**
 * Appends `<script defer src={url}>` to `<head>` unless this URL was already
 * loaded. Pass `{ module: true }` for a script that is a Dioxus
 * `document::Script { r#type: "module", .. }` (one page script:
 * `features/spaces/pages/index/action_pages/discussion/script.js`, which uses
 * top-level `export` and therefore needs `type="module"` rather than a plain
 * classic script — `defer` is implicit for modules).
 */
export function loadLegacyScript(url: string, options?: { module?: boolean }): void {
  if (typeof document === "undefined" || loaded.has(url)) return;
  loaded.add(url);
  const script = document.createElement("script");
  if (options?.module) {
    script.type = "module";
  } else {
    script.defer = true;
  }
  script.src = url;
  document.head.appendChild(script);
}

/** Loads a legacy page script after the calling component mounts. */
export function useLegacyScript(url: string, options?: { module?: boolean }): void {
  useEffect(() => {
    loadLegacyScript(url, options);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, options?.module]);
}
