# 05 — PR preview CI on the home k3s cluster

The PR browser-e2e path (`playwright-tests` on ubuntu-latest + docker compose)
has been replaced by a per-PR preview deployed onto the home k3s cluster,
modeled on asset's proven `pr-workflow.yml` e2e pattern. One deliberate
difference: **ratel tears the preview down as soon as the tests finish**;
asset keeps its preview alive for the PR's lifetime.

## Architecture

```
GitHub PR
   │
   ▼
self-hosted runner pod (biyard org, home k3s, arm64, no docker CLI)
   │  build-image job: npm i → make build-testing (native arm64 dx build)
   ▼
buildkitd (tcp://buildkitd.infra.svc.cluster.local:1234)
   │  scripts/buildkit-image.sh — packages target/dx/app-shell/release/web
   │  with app/ratel/Dockerfile (no compile inside the Dockerfile)
   ▼
in-cluster registry (registry.infra.svc.cluster.local:5000)
   │  ratel-app-shell:pr-<num>   (k3s nodes resolve the name via registries.yaml)
   ▼
namespace ratel-pr-<num>          (e2e job: envsubst deploy/pr-preview/*.yaml)
   ├─ localstack   Deployment+Service :4566  (dynamodb, s3, sqs, streams)
   ├─ localstack-init  Job  — scripts/localstack-init-entrypoint.sh via
   │                    ConfigMaps (table + GSIs + streams + seed fixtures)
   ├─ qdrant       Deployment+Service :6333/:6334
   ├─ qdrant-init  Job  — creates the ratel-local-main collection
   ├─ app-shell    Deployment+Service :8080  (initContainer waits for the
   │                    ratel-local-main table before the server starts)
   └─ Ingress      ratel-<num>.pr.biyard.co → app-shell:8080
   ▼
ingress-nginx (ns infra) — the exact-host Ingress takes the name over from
the wildcard *.pr.biyard.co pr-nginx; the host rides the default TLS cert
   ▼
Playwright pod (mcr.microsoft.com/playwright:v1.58.2-noble, in the PR ns)
   kubectl cp playwright/ in → npm ci → npx playwright test tests/web
   chromium pinned to the ingress ClusterIP via E2E_HOST_RESOLVER_RULES
   ("MAP <host> <ingress-ip>"), ignoreHTTPSErrors env-gated in
   playwright.config.js → report/results kubectl cp'd back out
```

Why the compose hostnames survive: the app image is built with the SAME
compile-time env block the old `ratel-app` job used
(`DYNAMO_ENDPOINT=http://localstack:4566`, `DYNAMO_TABLE_PREFIX=ratel-local`,
`ENV=local`, bypass features). The k8s Services are named `localstack` and
`qdrant` — identical to the docker-compose hostnames — so every endpoint
baked into the binary keeps resolving in-cluster without a rebuild.

## Lifecycle

1. **PR push** → `build-image` (self-hosted): native arm64 build, push
   `ratel-app-shell:pr-<num>`. The x86 `ratel-app` docker-artifact job
   survives ONLY as the tauri-android-smoke-test backend.
2. **e2e** (needs build-image): recreate `ratel-pr-<num>` clean → create
   script/seed ConfigMaps → envsubst-apply `deploy/pr-preview/*.yaml` → wait
   (init Jobs complete → rollouts → curl the ingress with `--resolve`) → run
   the suite in the Playwright pod → dump pod logs into the job log →
   publish the HTML report to `/root/nginx/ratel-report-<num>/` (served at
   `https://ratel-report-<num>.pr.biyard.co`) → sticky PR comment
   (`<!-- e2e-preview -->`) with the **live preview URL**
   (`https://ratel-<num>.pr.biyard.co`) and the report URL. The namespace is
   NOT torn down — the preview stays clickable for the PR's lifetime
   (asset pattern; each new run still starts from a clean recreate). The
   exception is a run that outlived its own PR: the last step re-reads the
   PR state and, if it is already closed, deletes the namespace it just
   created (see "Namespace leak" below).
3. **PR close** → `pr-preview-cleanup.yml` (primary teardown): cancels the
   PR's in-flight runs and waits for them to stop, then deletes the
   namespace, removes the report webroot, updates the sticky comment, and
   **verifies** the namespace is gone (clearing wedged finalizers, failing
   loudly if it survives). No database step — the preview is fully
   namespace-contained.
4. **Hourly** → `pr-preview-sweeper.yml` (backstop reconciler): deletes every
   `ratel-pr-<num>` namespace and `ratel-report-<num>` webroot whose PR is no
   longer open, and unwedges namespaces stuck in `Terminating` for 10+ min.
   It deletes only on a definite non-open answer from the API — any error
   response leaves the preview alone for the next pass. `workflow_dispatch`
   with `dry_run: true` lists what it would remove.

### Namespace leak (fixed 2026-08-10)

Close-time teardown alone was racy: e2e queues behind `build-image` for
20-30 min on the self-hosted pool, so a PR merged the moment its required
checks go green fires `pr-preview-cleanup.yml` **before e2e has even
started**. The delete hit a namespace that did not exist yet (a 37 ms no-op
that reported success), e2e created `ratel-pr-<num>` minutes later, and
nothing was left to remove it. Four namespaces leaked this way
(#1735/#1736/#1739/#1740 — e2e started 20-28 min after the merge in every
case) and had to be deleted by hand.

The teardown is now defence in depth, because no event-time hook can close
the window on its own:

| Guard | Covers |
|---|---|
| `concurrency: pr-testing-<num>` on `pr-workflow.yml` | a second push leaving two runs fighting over one namespace |
| e2e's last step (self-teardown when the PR is closed) | a run that outlived its PR |
| cleanup cancelling in-flight runs before deleting | a run about to recreate the namespace behind cleanup's back |
| cleanup verifying the delete + clearing finalizers | a namespace wedged in `Terminating` passing as success |
| `pr-preview-sweeper.yml` (hourly) | everything else, including runs cancelled too late to self-clean |

The e2e job is `continue-on-error: true` (non-blocking) while the new path
stabilizes; promote it to a required check once it has green history.

## Debugging a failed run

- **Playwright report** — `https://ratel-report-<num>.pr.biyard.co` (sticky
  PR comment links it). Contains per-test screenshots, videos, and traces;
  published on failure too, with a placeholder page if no report was made.
- **Server-side story** — the "Dump pod logs" step prints every
  deployment's and job's logs into the job log; the namespace also stays up
  after the run, so `kubectl -n ratel-pr-<num> logs deploy/app-shell` works
  live until the PR closes.
- **Which phase died** — the wait step fails with the culprit's name:
  `job/localstack-init` (table/seed script), `job/qdrant-init`,
  a `rollout status` (image pull / crash / initContainer stuck waiting for
  the table), or the ingress curl (routing).
- **Reproduce locally** — the stack is the same shape as
  `docker compose --profile testing`; or, with cluster VPN access, run the
  e2e steps by hand with `PR_NUM=<something-unused>` and keep the namespace
  around (skip the teardown step) to poke at it with kubectl.
- **Manifest sanity** — `PR_NUM=999 envsubst '${PR_NUM}' < deploy/pr-preview/<f>.yaml | kubectl apply --dry-run=client -f -`.

## Persistence model (asset-style, since 2026-08-04)

Previews persist until PR close: the e2e job leaves the namespace running so
the sticky comment's preview URL stays clickable; `pr-preview-cleanup.yml`
is the primary teardown at close time, with `pr-preview-sweeper.yml` as the
hourly reconciler that makes the leak self-healing.

Auditing what is actually up:

```bash
kubectl get ns -l app.kubernetes.io/part-of=ratel-pr-preview
```

Anything there whose PR is closed means every guard missed — check the
sweeper's most recent run first (its job summary tables each namespace with
the PR state it read).

Cost of persistence: one localstack + qdrant + app-shell set per open PR
(~1 GB RAM each), and LocalStack state lives in the pod (PERSISTENCE=0) —
a pod restart loses seeded data. Fine for reviewing what the test run left
behind; if long-lived previews start surprising reviewers after restarts,
re-enable persistence onto a PVC or rerun the init Job on restart. To go
back to teardown-on-finish, re-add a `kubectl delete namespace` step at the
end of the e2e job.
