# Phase 5 — Event pipeline cutover + DynamoDB decommission

**Author / Date**: migration · 2026-08-07 (revised 2026-08-07: Redpanda → Postgres outbox poller)
**Depends on**: Phases 1–4 (data layer on Postgres, tests green, ETL). Companion to
`2026-08-06-dynamodb-to-postgres-migration.md`.

## Why this phase exists (current state after Phase 1–3)

The async side-effect pipeline used to be:

```
entity write → DynamoDB Stream → ratel_cdc (bin) → Redpanda → ratel_worker (bin) → dispatcher → side effects
```

Phase 1 moved **all entity writes to Postgres** (verified: 0 live DynamoDB writes).
Therefore the DynamoDB Stream now has nothing to stream, so `ratel_cdc` produces
nothing, so the `dispatcher` fires nothing. **The CDC-driven side effects are dead.**

Critical, user-visible side effects were already made **inline** during Phase 1
(e.g. discussion mention + subscriber notifications are enqueued directly in
`discussion/controllers/comments/add_comment.rs`). What remains CDC-only (and
therefore currently inert) must be driven from Postgres.

Key files (sizes indicate scope):
- `common/events/dispatcher.rs` (1142 lines, ~69 filter/dispatch rules ported 1:1 from
  `cdk/lib/dynamo-stream-event.ts`) — **kept unchanged; it is the reusable core**
- `common/events/{producer,consumer,cdc_event,checkpoint,config}.rs` (Redpanda, feature `redpanda`)
- `common/stream_poller.rs` (233, local-dev DynamoDB stream poller), `common/stream_handler.rs` (52)
- bins `ratel_cdc.rs`, `ratel_worker.rs`
- 45 files still reference `aws_sdk_dynamodb`

## Decision: Postgres outbox poller (not Redpanda)

The original plan reused the existing Redpanda producer/consumer/worker path
(`mutation → produce(CdcEvent) → Redpanda → ratel_worker → dispatch`). We chose a
**Postgres-native outbox poller** instead. Both are real *async* pipelines (neither
blocks the request the way an inline handler call would); the difference is only the
**transport** — a table poll vs. an external broker.

Why the poller:
- **No new always-on infrastructure.** Redpanda would add a broker pod + a
  `ratel_worker` pod running 24/7, plus `rdkafka` (librdkafka, cmake build) into the
  app image. The poller adds **zero** external infra and no new CI services — it reuses
  the Postgres we already run.
- **Cheaper.** The broker + worker are fixed always-on cost. The poller is an in-app
  background task issuing an indexed `WHERE created_at > checkpoint ORDER BY created_at
  LIMIT n` query — an index scan that returns 0 rows when idle. A unified outbox table
  + `LISTEN/NOTIFY` drives idle cost to ≈0 and latency to near-real-time.
- **Most faithful DynamoDB analogue.** A DynamoDB Stream *is* "watch a table for
  changes → hand the change to a handler". The poller reproduces exactly that on
  Postgres, feeding the **unchanged** `dispatcher` (same 69 handlers, same logic).

### Target architecture — one unified `event_outbox` table

Every mutation that must trigger a rule writes **one row** to a single generic
`event_outbox` table carrying the same tuple a DynamoDB Stream record carried
(`event_name`, `pk`, `sk`, `new_image`, `old_image` as jsonb). A single generic poller
drains it — no per-entity code, extensible by one `emit_*` line per mutation site.

```
mutation site → EventOutbox::emit_insert / emit_modify / emit_remove(pk, sk, …)
                        │  (INSERT one event_outbox row; both images as jsonb)
   outbox poller (in-app background task; single-processing via pg_advisory_lock)
      → drain rows WHERE processed_at = 0 (created_at order)
      → row.to_cdc_event()  → dispatch(&CdcEvent, RoleSet::all())  → existing handler
      → mark row processed
```

Implementation: `common/events/outbox.rs` — the `EventOutbox` model + `EventImage`
(jsonb) + `emit_insert/emit_modify/emit_remove` + `to_cdc_event` + the poller.
Spawned from `common/run.rs` on every server deployment.

Why one unified table covers **all** rule kinds:
- The row carries **both images**, so INSERT, MODIFY (old↔new comparison), and REMOVE
  rules are all expressible. `to_cdc_event` rebuilds the DynamoDB-shaped image
  (`serde_dynamo::to_item(jsonb)` + injected `pk`/`sk`) the dispatcher matches on, so
  `dispatcher.rs` is **unchanged** (same 69 handlers, same sk-prefix + field filters).
- **No history replay on deploy**: `event_outbox` starts empty; only events emitted
  after the feature ships are ever dispatched. (An entity-table poller keyed on a
  `created_at` checkpoint would have to be initialized to "now" to avoid replaying all
  history — the outbox sidesteps that entirely.)
- **`processed_at = 0` sentinel drain** (not a cursor): restart-safe, no same-timestamp
  boundary edge cases; processed rows can be reaped by age later.

### Behavior parity — what is and isn't automatic

- Rules already backed by a **dedicated event row** (e.g. `SpaceStatusChangeEvent`
  carries `old_status`+`new_status` explicitly) → the poller drives them with **no
  mutation-site change**: the row is the outbox entry.
- Rules that watched a **raw entity table** for a MODIFY/REMOVE transition → the
  mutation site must emit an explicit event row capturing the transition. This is
  **inherent to leaving DynamoDB** (Postgres has no stream at all) — it is the same
  per-rule wiring the Redpanda plan required, not a poller-specific limitation. Once
  wired, behavior is identical to DynamoDB (same handler, same recipients).
- Ordering (`ORDER BY created_at`) is a stronger global-time order than DynamoDB's
  per-key order. Delivery is at-least-once (checkpoint advances after dispatch); the
  dispatcher rules are already idempotent, so re-delivery on restart is safe.

## Cutover plan (incremental — each step keeps `cargo test` green)

1. **Outbox framework + generic poller.** `common/events/outbox.rs`: the `EventOutbox`
   model (`event_outbox` table), `EventImage` jsonb wrapper, the `emit_insert/
   emit_modify/emit_remove` API, `to_cdc_event`, and the single generic drain loop with
   the `pg_advisory_lock`. Spawned from `common/run.rs`. **Done in this revision.**
2. **Wire the first rule — `SpaceStatusChangeEvent`** (the one the Playwright
   `team-space-full-lifecycle` bell test needs). `update_space.rs` calls
   `EventOutbox::emit_insert(space_pk, "SPACE_STATUS_CHANGE_EVENT#{id}", &event)`.
   Verify the participant notification fires end-to-end. **Done in this revision.**
3. **Enumerate the ~70 dispatch rules** and classify each: (a) already inline (no work),
   (b) needs async → add one `emit_*` line at its mutation site (INSERT/MODIFY/REMOVE as
   appropriate — the poller and table are already generic), (c) obsolete (retired feature
   → delete the rule). Produce a rule→emit-site table. Do them **one at a time**, running
   the relevant `*_tests.rs` after each. ~23 INSERT / 8 MODIFY / 6 REMOVE filters today.
4. **Delete the DynamoDB stream source**: remove `ratel_cdc.rs`, `stream_poller.rs`,
   `stream_handler.rs`, and the `DetailType`/`EventBridgeEnvelope::proc` stream-decoding.
   Redpanda `producer/consumer` + `ratel_worker` may be retired too (the poller replaces
   them) unless kept for a future high-throughput path — decide at this step.
5. **Remove `aws_sdk_dynamodb`**: drop the 45 references — vestigial `_cli` params,
   `TestContext.ddb`, `config/server/dynamodb.rs`, the `aws-sdk-dynamodb*` deps, and the
   `DYNAMO_TABLE_PREFIX` compile-time requirement. Update the ~29 test helpers taking
   `_cli: &aws_sdk_dynamodb::Client`.
6. **Drop the table**: retire `ratel-<env>-main` DynamoDB table + its stream in CDK.

## Risk controls

- 69 interconnected rules × behavior-preservation ("기존 로직 유지") ⇒ rule-by-rule with
  the test suite green after each, not one sweep.
- The 498-test green baseline (Phase 3) + the Playwright suite are the guardrails: a rule
  cutover that changes a notification's recipients or timing must break an existing test.
- `aws_sdk_dynamodb` removal is mechanical but touches 45 files + the harness; it is the
  *last* step, after the event source is off Dynamo, so nothing regresses mid-way.

## Status
- Poller framework + first rule (`SpaceStatusChangeEvent`): **in progress** (this revision).
- Remaining rule enumeration/wiring: pending, incremental.
- Everything upstream (data layer, tests, web build, ETL, Postgres seed) is done and green.
