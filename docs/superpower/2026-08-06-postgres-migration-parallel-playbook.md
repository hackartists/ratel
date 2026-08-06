# Postgres Migration — Parallel Execution Playbook

**Date**: 2026-08-06
**Purpose**: Run the remaining DynamoDB→Postgres model migration in **cheap parallel batches** without repeating the mistakes hit in wave 1. Companion to the design doc [`2026-08-06-dynamodb-to-postgres-migration.md`](2026-08-06-dynamodb-to-postgres-migration.md).

---

## 0. Current state (done)

- ✅ **ORM crates ported**: `packages/postgres` + `packages/postgres-macros` (from `~/Projects/asset`). Compile clean. **Do not modify.**
- ✅ **Foundation slice green**: `Session` model → `PostgresEntity`, `PostgresSessionStore`, PG pool in `common/config/server/postgres_pool.rs`, startup wiring in `run.rs` (`postgres::set_global_pool` + `Schema::from_inventory().migrate`).
- ✅ **Two systematic root causes pre-fixed** (these bit every model in wave 1 — now global, so batches won't hit them):
  1. The local config module was named `postgres` → **renamed to `postgres_pool`**. A local `postgres` module collides with the external `postgres` crate through `use crate::common::*` (`error[E0659]: postgres is ambiguous`). Never reintroduce a local `postgres` name.
  2. **`uuid` `serde` feature enabled** (workspace `Cargo.toml`). `id: Uuid` fields derive serde → needs it (`error[E0277]: uuid::Uuid: serde::Deserialize`).
- 🔵 **Wave 1** (character, cross_posting, timeline, launchpad_partner) converted; integration compile driven to green (199→68→28→0 in progress).

---

## 1. The gotchas every batch MUST honor (learned in wave 1)

1. **Server-gate all postgres code.** `postgres` is a **server-only optional dep**; the web/client half of the fullstack build (`cargo check --features server` compiles both) must not reference it. Mirror `common/models/session/mod.rs`:
   - `#[cfg(feature = "server")]` on `use postgres::...` imports.
   - `#[cfg(feature = "server")]` on the model struct + its `impl`s (if the struct is server-only), OR `#[cfg_attr(feature = "server", derive(postgres::PostgresEntity))]` + gated imports if the struct must exist on the client. Keep wire DTOs (`*Response`) cross-platform and server-gate only the raw model + its consumers.
2. **Use `postgres::` paths** (the ORM crate). Import `Uuid` as `use uuid::Uuid;` (workspace crate, now serde-enabled) — **not** `postgres::uuid::Uuid` (works but inconsistent).
3. **Error conversion**: `crate::common::Error: From<postgres::Error>`. On repository results, `.map_err(crate::common::Error::from)` (or the feature error's `::from`) before `?`/`.collect::<Result<Vec<_>, Error>>()`.
4. **Cross-feature reference ids** (user_pk, space_pk, team_pk, post/feed id owned by another feature): plain `Uuid`/`String` column, **no `references=` FK** (target table not migrated yet — FK constraints are a final pass). Preserve `Partition`-string form (`"USER#..."`/`"TEAM#..."`) where the prefix carried meaning (e.g. character actor = User or Team).
5. **Do NOT remove `Partition`/`EntityType` variants** — un-migrated features still use them. Only stop using them in the converted feature.
6. **Retire obsolete DynamoDB backfill migrations.** Migrations under `common/migrations/` that construct `{pk, sk}` and call DynamoEntity write methods for a now-Postgres entity are dead — remove from `migrations/mod.rs` + `runner.rs` and delete the file (e.g. `m001_backfill_character_xp` was retired).
7. **Tests** (`#[cfg(test)]`) target a DynamoDB `TestContext` — they don't block `cargo check --features server`. Leave them; they need a Postgres test harness (separate task).

---

## 2. Postgres ORM API cheatsheet (give this to every agent inline — don't make them re-read the docs)

```rust
// ── Derives ─────────────────────────────────────────────────────────────
#[cfg(feature = "server")]
#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq, postgres::PostgresEntity)]
#[postgres(table = "things", unique(owner_id, name))]   // struct-level composite unique (repeatable)
pub struct Thing {
    pub id: Uuid,                                    // surrogate PK, minted now_v7 on insert if nil
    #[postgres(index)] pub owner_id: Uuid,           // cross-feature ref → NO references=
    #[postgres(references = "things(id)", on_delete = "CASCADE")] pub parent_id: Uuid, // intra-feature FK
    #[postgres(order)] pub created_at: i64,          // default sort key
    pub state: ThingState,                           // native enum (see below)
    pub blob: ThingBlob,                             // opaque jsonb (see below)
}
#[cfg(feature = "server")]
#[derive(..., postgres::PostgresEnum)] pub enum ThingState { Pending, Done }   // CREATE TYPE … AS ENUM
#[cfg(feature = "server")]
#[derive(..., postgres::PostgresJson)] pub struct ThingBlob(pub serde_json::Value); // jsonb newtype

// ── Repository (writes / by-id) ─────────────────────────────────────────
Thing::repository().insert(&t).await?;                        // INSERT … RETURNING
Thing::repository().upsert(&t).await?;                        // ON CONFLICT(pk) DO UPDATE
Thing::repository().upsert_on(&["owner_id","name"], &t).await?; // natural-key upsert (keeps id/created_at)
Thing::repository().get_by_id(id).await?;                     // Option<Thing>
Thing::repository().delete_by_id(id).await?;                  // (swallow postgres::Error::NotFound for idempotent delete)
Thing::repository().update(id, ThingUpdate { .. }).await?;

// ── Query (reads / lists) ───────────────────────────────────────────────
use postgres::ops::{StringOp, NumOp, BoolOp, UuidOp, EnumOp, JsonOp};
let page: postgres::Page<Thing> = Thing::query()
    .owner_id(UuidOp::Eq(owner))
    .state(EnumOp::Eq(ThingState::Pending))
    .order_by(ThingColumn::CreatedAt, postgres::Order::Desc)
    .page(1).page_size(20)
    .find().await?;
// Page<T> { items, page, page_size, total_count, total_pages }.  find_one() -> Option<T>.
// ListResponse<T> (Dynamo bookmark) → Page<T> at the DTO boundary.

// ── Transactions (multi-entity atomic; replaces transact_write_items) ───
let tx = postgres::Tx::begin().await?;
A::repository().with_tx(&tx).insert(&a).await?;
B::repository().with_tx(&tx).upsert(&b).await?;
tx.commit().await?;                                          // Drop w/o commit = rollback

// ── Optimistic lock (replaces DynamoDB conditional UpdateItem) ──────────
// UPDATE … SET lock_id=$m WHERE key=$k AND state='pending' AND (lock_id IS NULL OR ttl expired)
// affected_rows == 0  ⇔  ConditionalCheckFailed. Run via repository().db().execute(query_builder).

// ── ETL deterministic id (for backfill runners) ─────────────────────────
fn key_to_uuid(k: &str) -> Uuid { Uuid::new_v5(&RATEL_NS, k.as_bytes()) }
//  id      = key_to_uuid("USER#abc#SOCIAL_CONNECTION#twitter")
//  user_id = key_to_uuid("USER#abc")   ← equals User's own id → FK resolves, no lookup table
```

Model methods **no longer take `cli: &aws_sdk_dynamodb::Client`** — they use the global pool.

---

## 3. Batch plan (dependency-ordered)

Remaining feature modules (≈120 models). Batch them small (**3–4 features per parallel wave**, edit-only in the main tree, no per-agent compile, central integration compile). Cross-feature ids stay plain columns; **FK constraints + native-FK are a final pass**, so features are independent within a wave.

| Wave | Features (models) | Notes |
|---|---|---|
| 1 ✅ | character(3), cross_posting(5), timeline(1), launchpad_partner(1) | done / integrating |
| 2 | activity(2), essence(2), ai_moderator(2), social(3) | small, low inbound coupling |
| 3 | membership(2), sub_team(9) | membership feeds many; do before spaces |
| 4 | posts(11) | referenced by spaces/timeline/cross_posting |
| 5–7 | spaces(35) — **sub-sliced** by sub-feature: poll / quiz / discussion / analyze / reward / space_common / … | biggest; 3–4 sub-features per wave |
| 8 | arcade(15) | |
| 9 | auth(14) + common/models/auth (User, UserFollow, AdminUser, TestAccount) | **User = highest inbound-FK blast radius**; do near-last, then the FK-constraint pass can point everything at `users(id)` |
| 10 | common/models remainder: did, notification, reward | |
| FK pass | add `references=` on all cross-feature `*_id` columns now that every table exists | one pass |
| ETL pass | per-feature backfill runners (§2 uuid-v5), run dev → verify parity → prod | |
| Events | DynamoDB Streams/CDC → explicit `produce` (design doc §4) | removes `ratel_cdc`/streams |
| Decommission | delete DynamoEntity/by-macros dynamo bits, `aws-sdk-dynamodb`(+streams), drop `ratel-<env>-main` | |

---

## 4. Per-wave procedure

1. **Spawn N feature agents in parallel** (main tree, no worktree, no per-agent compile). Each agent gets: the §1 gotchas, the §2 cheatsheet **inline** (so it doesn't burn tokens re-reading docs), its feature path, and the instruction to (a) convert models (P1–P9) + controllers + services + **ETL runner**, (b) server-gate postgres code, (c) list — not edit — external callers, (d) not run cargo.
2. **Integration (orchestrator, sequential)**: `cd app/ratel && DYNAMO_TABLE_PREFIX=ratel-dev cargo check --features server`.
   - The two root causes are already global-fixed, so expect only per-file errors.
   - Fix external callers centrally (signatures dropped `cli`, renamed methods, `pk`/`sk` gone).
   - Retire obsolete DynamoDB backfill migrations.
   - Iterate to zero errors. A single focused fix-agent can own this loop if the error count is high.
3. **Verify green** with `cargo check --features server` (only the `num-bigint-dig` future-incompat NOTE is allowed). Optionally `--features web` to confirm the client half still builds (catches missed server-gating).
4. **Commit the wave** (clean checkpoint) before the next.

### Cost control (why wave 1 was expensive)
- Wave 1's worktree attempt (cold compile per agent) + main-tree agents re-reading all docs burned ~1.2M tokens for 10 models. Mitigations baked into this playbook: **no worktrees**, **API cheatsheet inline** (no doc re-reading), **no per-agent compile**, **root causes pre-fixed globally**, **small batches**. If agents still prove costlier than hand-conversion for a given feature, the orchestrator converts it directly using §2.

---

## 5. Definition of done (per wave)
- [ ] Every model in the wave derives `PostgresEntity`/`PostgresEnum`/`PostgresJson`, server-gated.
- [ ] Feature controllers/services use the repository/query API (no `cli`, no DynamoEntity methods).
- [ ] External callers fixed; obsolete DynamoDB migrations retired.
- [ ] ETL runner present (uuid-v5, topo order, idempotent upsert).
- [ ] `cargo check --features server` **and** `--features web` green.
- [ ] Wave committed.
