# app-shell (Ratel API server)

API-only Rust server: Axum + Dioxus fullstack server-function macros
(`#[get]`, `#[post]`, …), DynamoDB/Postgres models, MCP server, event workers
(`src/bin`). The web UI is the React app in `apps/web`, which talks to this
server over the same origin (the k3s ingress routes `/api`, `/v3`, `/mcp`,
`/hooks`, `/launchpad/health`, `/launchpad/points`, `/admin/proxy` here).

```bash
make run             # local server on :8080 (features server,local-dev,bypass)
make test            # server-function integration tests (localstack + postgres)
make gen-ts          # regenerate packages/ts-bridges after API changes
make build           # release binary -> target/server-image/server (Dockerfile context)
make build-testing   # same with bypass + local-dev (PR preview)
```

Checks: see `.claude/rules/conventions/build-commands.md`.
