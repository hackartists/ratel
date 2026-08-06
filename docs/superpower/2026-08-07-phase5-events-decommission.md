# Phase 5 — Event pipeline cutover + DynamoDB decommission

**Author / Date**: migration · 2026-08-07
**Depends on**: Phases 1–4 (data layer on Postgres, tests green, ETL). Companion to
`2026-08-06-dynamodb-to-postgres-migration.md`.

## Why this phase exists (current state after Phase 1–3)

The async side-effect pipeline is:

```
entity write → DynamoDB Stream → ratel_cdc (bin) → Redpanda → ratel_worker (bin) → dispatcher → side effects
```

Phase 1 moved **all entity writes to Postgres** (verified: 0 live DynamoDB writes).
Therefore the DynamoDB Stream now has nothing to stream, so `ratel_cdc` produces
nothing, so the `dispatcher` fires nothing. **The CDC-driven side effects are dead.**

Critical, user-visible side effects were already made **inline** during Phase 1
(e.g. discussion mention + subscriber notifications are enqueued directly in
`discussion/controllers/comments/add_comment.rs`, not via the stream). What remains
CDC-only (and therefore currently inert) must be moved to **explicit produce** at the
mutation site — the asset model (`packages/event` `produce()` / `produce_keyed()`).

Key files (sizes indicate scope):
- `common/events/dispatcher.rs` (1142 lines, ~69 filter/dispatch rules ported 1:1 from
  `cdk/lib/dynamo-stream-event.ts`)
- `common/types/event_bridge_envelope.rs` (470) — `DetailType` enum + `proc()`
- `common/stream_poller.rs` (233, local-dev), `common/stream_handler.rs` (52)
- `common/events/{producer,consumer,cdc_event}.rs` (Redpanda, feature `redpanda`)
- bins `ratel_cdc.rs`, `ratel_worker.rs`
- 45 files still reference `aws_sdk_dynamodb`

## Target architecture (asset parity)

```
mutation site → produce_keyed(topic, key, payload)  →  Redpanda  →  consumer loop → dispatcher → side effects
```

No DynamoDB, no stream, no `ratel_cdc`. `ratel_worker` keeps consuming Redpanda; only
the *source* changes from CDC-of-Dynamo to explicit produce.

## Cutover plan (safe, incremental — each step keeps `cargo test` green)

1. **Port the produce framework.** Copy `~/Projects/asset/packages/event` →
   `packages/event` (produce/produce_keyed + `#[event]` macro + config). Additive;
   compiles independently. Wire `event = { path = "packages/event" }` into the app.
2. **Enumerate the live dispatch rules.** For each of the ~69 rules in `dispatcher.rs`,
   classify: (a) already inline (delete the rule), (b) still needed async (needs a
   produce site), (c) obsolete (retired feature → delete). Produce a rule→site table.
3. **Per rule needing async**: at the Postgres mutation that used to trigger it, add
   `event::produce_keyed(<topic>, <key>, <payload>).await` mirroring the old stream
   record. Keep the dispatcher handler body unchanged (1:1 behavior). Convert the
   consumer to decode the produced payload instead of a `CdcEvent`.
   Do this **one rule at a time**, running the relevant `*_tests.rs` after each.
4. **Delete the DynamoDB source**: remove `ratel_cdc.rs`, `stream_poller.rs`,
   `stream_handler.rs`, the `DetailType`/`EventBridgeEnvelope::proc` stream-decoding,
   and the CDK `dynamo-stream-event.ts` pipes/rules.
5. **Remove `aws_sdk_dynamodb`**: drop the 45 references — the vestigial `_cli` params
   (already unused, documented in Phase 1b), `TestContext.ddb`, `config/server/dynamodb.rs`,
   the `aws-sdk-dynamodb*` deps in Cargo.toml, and the `DYNAMO_TABLE_PREFIX` compile-time
   requirement. Update the ~29 test helpers that still take `_cli: &aws_sdk_dynamodb::Client`.
6. **Drop the table**: retire `ratel-<env>-main` DynamoDB table + its stream in CDK.

## Risk controls (why this is a follow-up, not a 3am big-bang)

- 69 interconnected rules × behavior-preservation ("기존 로직 유지") ⇒ must be done
  rule-by-rule with the test suite green after each, not in one sweep.
- The 498-test green baseline (Phase 3) is the guardrail: every step re-runs
  `cargo test --features server,bypass`. A rule cutover that changes a notification's
  recipients or timing must be caught by the existing notification/subscription tests.
- `aws_sdk_dynamodb` removal is mechanical but touches 45 files + the test harness; it
  is the *last* step, after the event source is off Dynamo, so nothing regresses mid-way.

## Status
- Framework port + rule enumeration: **not started** (this doc is the plan).
- Everything upstream (data layer, tests, web build, ETL) is done, committed, and green,
  so this phase can proceed incrementally without blocking anything already shipped.
