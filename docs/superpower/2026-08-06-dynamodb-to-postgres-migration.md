# DynamoDB → PostgreSQL Migration & DynamoDB Decommission — System Design

**Date**: 2026-08-06
**Scope**: Migrate Ratel's **entire DynamoDB footprint** to PostgreSQL — the data layer **and** the DynamoDB-Streams-driven event pipeline — and then **remove DynamoDB completely** (no `aws-sdk-dynamodb` / `aws-sdk-dynamodbstreams` dependency, no `ratel-<env>-main` table). Uses the completed migration in `~/Projects/asset` (Biyard Assets) as the reference playbook for both halves.
**Reference template**: `~/Projects/asset` — `packages/postgres`, `packages/postgres-macros`, `packages/event`, `packages/event-macros`, and `docs/legacy/postgres-migration/{migration-plan,decisions,data-model-analysis}.md`.

---

## 1. Summary

Ratel today puts ~190 logical entity types on **one physical DynamoDB table** (`ratel-<env>-main`) via string `(pk, sk)` keys (130 `#[derive(DynamoEntity)]` structs, 6 GSIs), and drives all async processing off **DynamoDB Streams** (`ratel_cdc → Redpanda → ratel_worker → dispatcher`, ~40 pk/sk-prefix rules). This design removes DynamoDB entirely, in two coordinated tracks that proceed feature-by-feature:

- **Track A — Data layer.** Port Assets' `packages/postgres` + `postgres-macros` ORM; convert each `DynamoEntity` into a relational `PostgresEntity` (Assets' P1–P9 transform catalog); ETL-backfill existing data.
- **Track B — Event pipeline.** Replace the DynamoDB-Streams CDC with Assets' **explicit-produce** model: the application publishes typed domain events at the write site (`#[event]` + `produce`/`produce_keyed`), consumed by inventory-registered per-event handlers. **No change-data-capture at all** — so `ratel_cdc`, the stream reader/poller, and the pk/sk-prefix dispatcher are deleted, and DynamoDB Streams disappears.

When both tracks are done for every feature, DynamoDB is decommissioned.

### In scope
- 130 DynamoEntity models, `Partition`/`EntityType` keying, 6 GSIs / 133 finders, 26 raw transactional writes, the DynamoDB-backed session store.
- The full event pipeline: ~40 dispatcher rules → explicit typed events + handlers; deletion of `ratel_cdc`, `stream_handler`, `stream_poller`, `checkpoint`, and the DynamoDB-Streams source.
- ETL backfill of existing data.
- Final DynamoDB decommission (deps, config, table).

### Out of scope
- Redpanda itself and the `ratel_worker` runtime shell are **kept** (only their *source* changes from CDC to explicit produce). Qdrant, S3, auth providers, etc. are untouched.

---

## 2. Target architecture

Port four crates from Assets into `ratel/packages/`, adapting namespaces. They coexist with the current `by-macros` (DynamoEntity/DynamoEnum/SubPartition) and `common/events` until the last slice removes those.

| Crate | Provides |
|---|---|
| `packages/postgres` | `#[derive]`-driven runtime ORM: `PostgresRepository<T>`, global pool, `Tx`, `Page<T>`, typed `{Name}Query`/`{Name}Update`, inventory schema versioning (`Schema::from_inventory().migrate()`). SQL built at runtime via `sqlx::QueryBuilder`. |
| `packages/postgres-macros` | `PostgresEntity` (table), `PostgresEnum` (native enum), `PostgresJson` (jsonb). Attributes: `table`, `unique(...)`, `references`/`on_delete`, `index`, `pk`, `column`, `type`, `version = N`/`sql_default`, `order`/`find`, `skip`, relations, `skip_schema`. |
| `packages/event` | `produce(topic, &payload)` / `produce_keyed(topic, key, &payload)` (a `FutureProducer` singleton) + `consumer::run()` — an inventory-registered per-event handler loop with partition-level pause/resume, manual commit, graceful shutdown. |
| `packages/event-macros` | `#[event(service, data, version, key)]` — derives the topic string (`{ENV}.{service}.{data}.v{N}`) and, with `key = "field"`, keyed publishing for per-entity ordering. One typed struct = one event contract shared by producer and consumer. |

### Prefix & startup
- `DYNAMO_TABLE_PREFIX` (compile-time `option_env!`) → `POSTGRES_PREFIX` (runtime, `ident.rs::normalize_ident`).
- Every server process, after pool init and before serving:
  ```rust
  postgres::set_global_pool(pool.clone());
  postgres::Schema::from_inventory().migrate(&pool).await?;
  ```
  Additive schema via `#[postgres(version = N)]`; advisory lock serializes concurrent boots. No migration binary/container.

---

## 3. Track A — Data model: single-table `(pk, sk)` → relational

Apply Assets' antipattern-correction catalog to each of Ratel's ~190 `EntityType` shapes.

| # | DynamoDB residue | Relational correction |
|---|---|---|
| P1 | Synthetic/composite string keys (`USER#{id}`, `POST_COMMENT_REPLY#{a}#{b}`) | Surrogate `id uuid` (`now_v7`) + natural `UNIQUE(...)`, or genuine composite PK for pure junction rows |
| P2 | `*_json` / serialized blobs | Normalize to columns/child tables; keep `jsonb` (`PostgresJson`) only for genuinely opaque payloads |
| P3 | Embedded `Vec<Struct>`/`Vec<String>` | Child/junction table, 1 row = 1 element (+`position`); write via clear-then-`upsert_on(&[keys], &row)` |
| P4 | Stored aggregates (rank/score/count) | Compute at read time via hand-written `find_*` aggregation SQL — not VIEWs |
| P5 | Duplicated parent fields (cached ids/names) | FK + one-hop JOIN; snapshot only for immutable sent artifacts |
| P6 | Polymorphic refs (`member_id="EMAIL:.."`) | Discriminator + nullable partial FK, or `user_id uuid NULL` + `invited_email` |
| P7 | Enum as `String`/jsonb | Native `PostgresEnum` |
| P8 | Unconstrained `*_id: String` FKs | Real `references` on `Uuid` |
| P9 | DynamoDB shim (`pk`/`sk`, `SubPartition`, native TTL) | Drop shim; surrogate id + `updated_at`; TTL → explicit reaper (`DELETE WHERE expires_at < now()`) |

- **Keys/joins**: `Partition`/`EntityType` key-transform helpers (`to_space_pk`, `to_post_key`, …) are relational joins — each becomes an FK + query.
- **IDs**: surrogate `id uuid`, bare UUIDs on the wire (Ratel's `SubPartition` "id" DTO naming already fits); external-string PK for sessions.
- **GSIs → queries**: 6 GSIs / 133 finders → `#[postgres(index)]` + typed `query()`, or hand-written `find_*`; sort-key access → `query().x(Op::Eq(..)).order_by(..).page(n)`; `bookmark` cursor → `Page<T>` (also swaps `ListResponse<T>` envelope).
- **Transactions**: the 26 raw `transact_write_items` → `Tx` (shared across entity repos via `with_tx`).
- **Sessions**: `DynamoSessionStore` → `PostgresSessionStore`; `Session` `PostgresEntity` (external String PK, `data: SessionData` jsonb, `expires_at`); TTL → load-time guard + reaper.

---

## 4. Track B — Event pipeline: DynamoDB Streams/CDC → explicit produce (Assets model)

### End state (matches Assets — no CDC)
```
[app write path]                              [Redpanda]            [consumer]
  business action (e.g. poll answered)
    ├─ Postgres write (in Tx)
    └─ event::produce_keyed(topic, key, &TypedEvent)   ──▶  topic  ──▶  #[event] handler
       (#[event] macro defines topic/key)                              (inventory-registered,
                                                                        one handler per event type)
```
The current implicit model — *"any DynamoDB row change → stream → dispatcher figures out what to do via pk/sk prefix"* — becomes explicit: *"the code that performs the write publishes a named domain event; a typed handler consumes it."*

### Conversion
- Enumerate the **~40 dispatcher rules** in `common/events/dispatcher.rs` (`EventClass` Default/Analyze/Egress/Sse). Each rule = "when entity X changes, do Y."
- For each rule:
  1. Define a typed `#[event(...)]` struct for the domain event (e.g. `PollAnswered`, `AnalyzeReportRequested`, `PostEgressRequested`).
  2. At the **write site** for entity X, after the Postgres write, call `produce`/`produce_keyed`.
  3. Move handler `Y` into an inventory-registered `#[event]` consumer handler.
- Keep the existing **Redpanda topics + `ratel_worker` role split** (default/analyze/egress) — `analyze` still gets its own long-poll worker pool. Only the *source* changes.

### Deletions (once every rule is converted)
- `app/ratel/src/bin/ratel_cdc.rs` (stream reader/producer), `common/stream_handler.rs`, `common/stream_poller.rs`, `common/events/checkpoint.rs` (CDC shard checkpoints), `common/events/cdc_event.rs` + the pk/sk-prefix `dispatcher.rs`, `common/types/event_bridge_envelope.rs`.
- `aws-sdk-dynamodbstreams` dependency; `RATEL_CDC_START` and stream env.

### Atomicity caveat (Assets accepts this)
Postgres write and `produce` are **not** atomic (produce is outside the `Tx`); a crash between commit and produce loses that event. Assets accepts this for simplicity. **Recommendation**: adopt the same default, but wrap **critical events** (payments/rewards ledger) in a small **outbox** (event row written inside the same `Tx`, a tiny relay tails it) — a targeted hybrid, not a global CDC.

---

## 5. ETL backfill (Ratel runs it; Assets only documented it)

- Per entity type: DynamoDB `scan`/GSI query → discriminate by `sk` prefix → apply P1–P9 → insert into Postgres.
- **Idempotency & FK stability**: map each `(pk, sk)` to a deterministic **`uuid-v5`** surrogate id (re-runnable, FKs resolve without a lookup table).
- **Ordering**: FK topological order (same as schema `topo_sort_tables`).
- **Verification**: per slice, row-count parity + sampled field-level diff.
- Backfill runners are per-slice, not one monolith.

---

## 6. Decomposition & ordering

**Feature-unit vertical slices.** Each slice does **both tracks**: create tables → backfill → convert reads/writes to Postgres → convert that feature's stream-triggered side-effects to explicit `produce` + handlers → tests → commit CI-green.

Dependency order — foundation first (everything FKs to user/team/space):

1. **Slice 0 — crate port + template slice**: port `packages/{postgres,postgres-macros,event,event-macros}`; migrate **sessions** + **`common/models/auth`** (User, UserFollow, AdminUser, TestAccount). Establishes every pattern (uuid PK, native enum, child-table extraction, `find_*`, `Tx`, `#[event]` produce/handler, ETL runner, tests). This is the reference slice (Assets' `patent`).
2. Team + Space core (`SpaceCommon`, membership roots).
3. Posts (11).
4. Spaces sub-entities (35 — sub-sliced: poll / quiz / discussion / analyze / …). Analyze-related events (auto-analysis) convert here.
5. Remaining features: arcade (15), auth remainder (14), sub_team (9), cross_posting (5 — the Egress events), social/character/membership/essence/ai_moderator/activity/timeline/launchpad_partner.
6. `common/models` remainder (did, notification, reward).
7. **Decommission**: delete `by-macros` DynamoEntity/DynamoEnum/SubPartition, `common/models` Dynamo bits, `DynamoConfig`/`AwsConfig` DynamoDB pieces, `aws-sdk-dynamodb`(+streams), `serde_dynamo`; drop the `ratel-<env>-main` table.

Rough size: ~15 feature modules, ~130 entities, ~40 event rules → many slices over an extended period. Each slice ships independently.

---

## 7. Per-slice checklist

- [ ] `DynamoEntity` → `PostgresEntity` (`id: Uuid` PK; external/composite PK where justified).
- [ ] pk/sk prefix keys → FK columns + `UNIQUE`/`index` (P1, P8); embedded `Vec` → child table + `upsert_on` (P3); enum → `PostgresEnum` (P7); stored aggregates → `find_*` (P4).
- [ ] Each GSI finder → typed `query()` / hand-written `find_*`; `ListResponse<T>` → `Page<T>`.
- [ ] Raw `transact_write_items` in this feature → `Tx`.
- [ ] Each stream-triggered side-effect for this feature → typed `#[event]` + `produce` at write site + consumer handler; remove its dispatcher rule.
- [ ] ETL runner (uuid-v5, topo order) + parity/sample tests.
- [ ] Per-slice cutover: create tables → backfill → switch reads → switch writes (optional brief dual-write for highest-risk) → remove that feature's DynamoDB path.
- [ ] `rustywind` + `dx fmt`; `cargo check --features server` clean; `--features redpanda` clean.

---

## 8. Risks & open questions

- **Event-model change is the biggest single risk.** Going implicit→explicit means every currently-stream-triggered side-effect must be found and re-issued as an explicit `produce` at the right write site. A missed rule = a silently dropped side-effect (notification never sent, analyze never runs). Mitigation: derive the exhaustive list from `dispatcher.rs` (~40 rules) + `docs/k3s-migration/03-filter-matrix.md`, and add a per-event integration test that the handler fires.
- **Non-atomic produce.** Default (Assets) loses an event on crash between commit and produce; use the outbox hybrid only for ledger-critical events.
- **Transaction atomicity across slice boundaries.** A `transact_write_items` touching an entity migrated in a *different* slice can't share one PG `Tx`; sequence such writes so co-transacted entities migrate together.
- **`DYNAMO_TABLE_PREFIX` / `&Client` coupling.** 130+ files thread `cli: &aws_sdk_dynamodb::Client`; switching to the global-pool repo touches every model method signature.
- **Backfill on live prod.** Scan cost + consistency during read/write switch; validate uuid-v5 mapping on a dev copy first.
- **Stored-aggregate hotspots (P4).** Read-hot ranking/score fields become query-time aggregations — verify with indexes before switching reads.

## 9. Open decisions
- Which events (if any) warrant the outbox hybrid vs plain produce.
- Whether any slice needs a real dual-write window vs clean read-then-write switch.
- Exact slice boundaries within `spaces` (35 entities).
- Reuse Ratel's existing `ratel_worker` consumer shell vs adopt Assets' `packages/event` consumer wholesale (recommendation: adopt `packages/event` for full template parity; keep Ratel's role-split worker binary as the host process).
