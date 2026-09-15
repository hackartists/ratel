# Build & Verification Commands

The web UI is the React app in `apps/web`; `app/ratel` is the API-only Rust
server (Dioxus fullstack server-function macros, no UI). There is no `dx` step.

## API server (app/ratel/)

```bash
# MUST run after any code change in app/ratel — server build (warnings are errors)
cd app/ratel && DYNAMO_TABLE_PREFIX=ratel-dev RUSTFLAGS='-D warnings' cargo check --features server

# MUST run after any code change in app/ratel — client stubs used to generate the TS API client
cd app/ratel && DYNAMO_TABLE_PREFIX=ratel-dev RUSTFLAGS='-D warnings' cargo check --no-default-features --features tauri-web

# After changing a server function signature or wire type: regenerate the TS client (committed)
cd app/ratel && make gen-ts          # then commit packages/ts-bridges

# Local API server on :8080 (local-dev + bypass features)
cd app/ratel && make run

# Release image binary (API only) -> target/server-image/server
cd app/ratel && make build           # or: make build-testing (bypass + local-dev)
```

**`DYNAMO_TABLE_PREFIX` is required at compile time** for DynamoEntity. Use `ratel-dev` for dev, `ratel-local` for Docker local.

**`RUSTFLAGS='-D warnings'` is required** for all build checks. Warnings are treated as errors — code must compile clean with zero warnings.

## React web app (apps/web/)

```bash
# Shared JS bundles (ratel-app-shell.js, wallet-connect.js) -> apps/web/assets
npm ci --prefix apps/web/shell-js && npm run build --prefix apps/web/shell-js

pnpm -C apps/web typecheck
pnpm -C apps/web build               # -> apps/web/dist
pnpm -C apps/web dev                 # :5173, proxies API paths to VITE_API_TARGET (default dev)
pnpm -C apps/web test:server         # static server + link-preview meta tests

# Serve a build the way k3s does, proxying the API to a local server
PROXY_API=1 API_ORIGIN=http://localhost:8080 PORT=4173 node apps/web/server/serve.mjs
```

## Playwright E2E Tests

```bash
cd playwright && PLAYWRIGHT_BASE_URL=http://localhost:4173 npx playwright test <file>
```

## Local Dev (Docker)

```bash
make local        # full stack in Docker: web :4173 + API :8080 + infra + seed (docs/local-docker.md)
make local-down   # stop it
make run          # all services (legacy development profile)
AWS_REGION=ap-northeast-2 AWS_DEFAULT_REGION=ap-northeast-2 make infra        # infrastructure only (LocalStack, DynamoDB)
make stop         # stop all

docker start ratel-localstack-init-1 # Reset database
```
