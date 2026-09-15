# shell-js → TypeScript modules — System Design

**Prior doc**: [2026-09-14-react-frontend-migration.md](2026-09-14-react-frontend-migration.md) (§3.4.2 carried `app/ratel/js` over unmodified as `apps/web/shell-js`)
**Author / Date**: Claude (with victor) · 2026-09-15

## Summary

`apps/web/shell-js` builds two global IIFE bundles (`ratel-app-shell.js` 240 KB gzip, `wallet-connect.js` 556 KB gzip) that `index.html` loads on **every page** and React reaches through `window.ratel.*` / `window.walletConnect`. That was needed when the UI was Rust/wasm; React can import the same libraries directly. Move each feature into a typed module under `apps/web/src`, load its heavy library only when the feature is used, and delete the global bundles — the same shape as biyard/asset's console (npm imports, `await import()` for heavy libraries, no globals).

## What changes / what stays

| Feature | Today (shell-js) | Library | React caller | Target |
|---|---|---|---|---|
| Analyze charts + Excel | `spaces/apps/analyzes.js` → `ratel.spaces.apps.analyzes` | d3, xlsx | `components/analyzes/analyze-interop.ts` | `components/analyzes/analyze-charts.ts`, libs via `import()` |
| Incentive pool deploy | `spaces/apps/incentive-pool.js` → `ratel.spaces.apps.incentive_pool` | ethers | `incentive-pool-api.ts` reads `ratel.space_incentive_pool` | `pages/spaces/[spaceId]/apps/incentive-pool/hooks/incentive-pool-contract.ts` |
| Team DAO create | `teams/index.js` → `ratel.social.teams` | ethers | `dao-interop.ts` reads `ratel.ratel_team_dao` | `pages/[username]/dao/hooks/team-dao-contract.ts` |
| Google sign-in (web) | `auth/firebase.js` → `ratel.invoke("init_firebase" / "signIn")` | firebase | `components/auth/interop.ts` | `components/auth/firebase.ts` |
| Wallet connect | `wallet-connect/index.ts` → `window.walletConnect` | @walletconnect/sign-client, @reown/appkit | `components/auth/interop.ts` | `components/auth/wallet-connect.ts` |
| PortOne identity verification | `membership/index.js` + `users/credential.js` (near-duplicates) | PortOne CDN SDK (unchanged) | `components/membership/interop.ts`, `pages/membership/hooks/identity.ts`, `pages/credentials/hooks/kyc.ts`, `lib/identity-verification.ts` | one `lib/portone.ts`, both return shapes preserved |
| Token claim, theme helpers, in-app-browser detection | `tokens/`, `common/theme.js`, `detectInAppBrowser` | ethers / none | **no caller** | delete |

Unchanged: the PortOne `<script>` from `cdn.portone.io`, the inline theme script in `index.html` (it does not use `theme.js`), the Tauri branches (`isTauri()` → native `save_file` for Excel, native `google_sign_in`, PortOne `redirectUrl` inside the WebView), `legacy-scripts` (separate follow-up), every public function signature the React callers use.

## Pre-existing bugs this fixes

- **Incentive pool deploy and team DAO creation never worked through the bundle.** The JS registered `ratel.spaces.apps.incentive_pool` / `ratel.social.teams`, but the callers (Rust `wasm_bindgen` before the migration, the React port now) read `ratel.space_incentive_pool` / `ratel.ratel_team_dao`, which nothing sets. Importing the module directly removes the name lookup.

## Loading strategy

- Heavy libraries load with `await import("d3")`, `import("xlsx")`, `import("ethers")`, `import("firebase/…")`, `import("@reown/appkit")` inside the feature module, so Vite splits them into their own chunks.
- **Popup rule.** Firebase `signInWithPopup` and the AppKit modal must open inside the click's user activation; an `await import()` between the click and the popup lets browsers block it. The login modal therefore **preloads** firebase + wallet modules when it opens (and Firebase is initialized then, as `initFirebase()` already is), so the click handler reaches the popup without a network wait.
- AppKit registers custom elements globally: keep a module-level singleton so it is created once.

## Build / deploy clean-up (after all features move)

- `vite.config.ts` `legacyHead()`: drop the two `<script type="module">` tags.
- Delete `apps/web/shell-js/` (and its `package-lock.json`, `.gitignore` entries).
- Add the libraries to `apps/web/package.json` at the versions shell-js resolves today (firebase 12.13.0, ethers 6.16.0, d3 7.9.0, xlsx 0.18.5, @reown/appkit 1.8.19, @walletconnect/sign-client 2.23.7) — same versions, no behaviour change.
- Remove the "Build shared JS assets" steps: `.github/workflows/{pr,dev,prod,mobile-release}-workflow.yml`, `deploy/local/Dockerfile.web`, `app/ratel-tauri/Makefile` `web-build`, `apps/web/Dockerfile` if present.

## Order

One feature per commit, each verified before the next: 1. analyze charts + Excel → 2. PortOne → 3. incentive pool + team DAO → 4. Google sign-in → 5. wallet connect → 6. delete shell-js + build steps.

## Test plan

Automated (every step): `pnpm -C apps/web typecheck`, `pnpm -C apps/web build`, Playwright `React` project and the `tests/web` specs touching the feature, against `make local`.

Browser checks Claude runs on the local stack (headless Chromium):

| Feature | Check |
|---|---|
| Analyze | bar + pie chart SVG rendered; Excel export produces a `.xlsx` download that parses |
| PortOne | clicking verify opens the PortOne identity window (never proceed with payment) |
| Incentive pool / DAO | clicking deploy/create reaches the wallet-provider request (no "not loaded" error) |
| Google | "Continue with Google" opens a popup on `accounts.google.com` / the Firebase auth domain |
| Wallet | "Connect wallet" opens the AppKit modal |
| Bundle size | first-load JS for `/` no longer includes the two bundles |
| Mobile | Android emulator + iOS simulator build; login modal, analyze page and credentials page render |

Needs a person (listed for the user at the end): completing Google sign-in with a real account, connecting and signing with a real wallet, finishing a real PortOne identity verification, deploying a real incentive pool / DAO contract with a funded wallet.

## Risks

- Popup blocking (mitigated by preloading, verified by the popup check above).
- `xlsx@0.18.5` has known advisories on parsing untrusted files; we only **write** workbooks, and the version stays the same as today. Upgrading is a separate decision.
- Mobile: Tauri paths must keep their branches; covered by the emulator/simulator smoke.
