//! Unified Postgres event outbox — the Postgres-native replacement for the
//! DynamoDB Stream that used to drive the CDC `dispatcher`.
//!
//! See `docs/superpower/2026-08-07-phase5-events-decommission.md`.
//!
//! ## The one structure every event flows through
//!
//! On Postgres there is no change stream, so the CDC-driven dispatcher rules
//! would never fire. Instead, **the same transaction that changes state also
//! writes one row to `event_outbox`** (the transactional-outbox pattern), and a
//! background poller drains the table, rebuilds the `CdcEvent` the dispatcher
//! expects, and runs the **unchanged** `dispatch(&CdcEvent, RoleSet::all())`.
//!
//! ```text
//! mutation tx { state write … ; EventOutbox::emit_*_tx(&tx, topic, …) } commit
//!                        │  (one event_outbox row, atomic with the state change)
//!   outbox poller (one loop per Class, single-processing via pg_advisory_lock)
//!      → drain pending rows of that class (created_at order)
//!      → row.to_cdc_event() → dispatch(&CdcEvent, RoleSet::all())
//!      → success → mark processed;  failure → bump attempts / dead-letter
//! ```
//!
//! ## Robustness properties (why each column exists)
//!
//! - **Atomicity** — `emit_*_tx` inserts the outbox row through the caller's
//!   `postgres::Tx`, so the event is committed **iff** the state change is. No
//!   lost side effects, no phantom events. (`emit_*` non-tx variants exist for
//!   best-effort call sites and are documented as such.)
//! - **Poison isolation / DLQ** — a failing dispatch bumps `attempts`; at
//!   `MAX_ATTEMPTS` the row is dead-lettered (`failed_at` set, excluded from the
//!   drain) instead of blocking the queue forever. The loop never stops on one
//!   bad row.
//! - **Heavy-job isolation** — each row carries a [`Class`]; a dedicated poller
//!   loop drains each class, so a slow `Heavy` handler (analyze/AI) can never
//!   head-of-line-block latency-sensitive `Default` events (notifications).
//! - **Retention** — a reaper deletes processed rows older than `RETENTION_MS`
//!   so the table does not grow without bound.
//! - **No history replay on deploy** — `event_outbox` starts empty.
//! - **Single-processing across replicas** — `pg_advisory_lock` per class.
//!
//! ## Deferred (documented, not yet built)
//!
//! - **Intra-class parallelism**: rows of one class are dispatched serially to
//!   preserve per-entity order; a future step can dispatch disjoint topic-keys
//!   concurrently. The `Default`/`Heavy` split already parallelizes the two
//!   classes.
//! - **Lower latency**: the poll interval is fixed at [`POLL_INTERVAL`]; a
//!   `LISTEN/NOTIFY` wake would cut idle latency to near-zero.
//!
//! ## About `topic` (and the absence of `pk`/`sk`)
//!
//! This is Postgres — there are no DynamoDB `pk`/`sk` keys. The dispatcher was
//! ported 1:1 from the DynamoDB Stream filters and still routes rules by a
//! sort-key token (`new_sk_starts("POST")`, …). Each row carries a single
//! `topic` token (the routing token the matching rule expects) which the poller
//! feeds to the dispatcher as the `CdcEvent`'s `sk`; no `pk` is stored or
//! matched (0 rules route on `pk`; handlers read their entity out of the image).
//! Tokens live in one place, [`topic`], so call sites stay readable.

use crate::common::Result;
use crate::common::events::cdc_event::{CDC_SCHEMA_VERSION, CdcEvent, Image};
use crate::common::events::dispatcher::{RoleSet, dispatch};
use postgres::Tx;
use serde::{Deserialize, Serialize};
use serde_dynamo::AttributeValue;
use std::time::Duration;
use uuid::Uuid;

use postgres::{PostgresEntity, PostgresJson};

/// Dispatch class — isolates slow handlers from latency-sensitive ones. Each
/// class gets its own poller loop + advisory lock.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Class {
    /// Fast, latency-sensitive side effects (notifications, XP, indexing).
    Default,
    /// Slow/expensive handlers (analyze, AI moderator) that must not block
    /// `Default`.
    Heavy,
}

impl Class {
    const fn as_str(self) -> &'static str {
        match self {
            Class::Default => "default",
            Class::Heavy => "heavy",
        }
    }
    const ALL: [Class; 2] = [Class::Default, Class::Heavy];
    /// A stable, distinct `pg_advisory_lock` key per class.
    const fn lock_key(self) -> i64 {
        match self {
            // "RATEL-OB" + class discriminator.
            Class::Default => 0x5241_5445_4c4f_4201,
            Class::Heavy => 0x5241_5445_4c4f_4202,
        }
    }
}

/// A routing token bundled with its dispatch class. Declared once per rule in
/// [`topic`] so call sites read `topic::SPACE_STATUS_CHANGE`.
#[derive(Debug, Clone, Copy)]
pub struct Topic {
    /// The sort-key token the dispatcher rule matches on.
    pub token: &'static str,
    pub class: Class,
}

/// Routing tokens, one per wired dispatcher rule (Phase 5 doc). Add here as each
/// rule is wired — keeping the DynamoDB-shaped token strings out of call sites.
pub mod topic {
    use super::{Class, Topic};

    macro_rules! topic {
        ($name:ident, $token:literal, $class:expr) => {
            pub const $name: Topic = Topic { token: $token, class: $class };
        };
    }

    // ── Default class (fast, latency-sensitive: notifications, XP, activity) ──
    topic!(SPACE_STATUS_CHANGE, "SPACE_STATUS_CHANGE_EVENT#", Class::Default);
    topic!(SPACE_ACTIVITY, "SPACE_ACTIVITY#", Class::Default);
    topic!(SPACE_ACTION_STATUS, "SPACE_ACTION", Class::Default);
    topic!(POLL_USER_ANSWER, "SPACE_POLL_USER_ANSWER#", Class::Default);
    topic!(QUIZ_ATTEMPT, "SPACE_QUIZ_ATTEMPT#", Class::Default);
    topic!(FOLLOWER, "FOLLOWER#", Class::Default);
    topic!(NOTIFICATION, "NOTIFICATION#", Class::Default);
    topic!(USER_INBOX_NOTIFICATION, "USER_INBOX_NOTIFICATION#", Class::Default);
    topic!(SPACE_SCORE, "SPACE_SCORE", Class::Default);
    topic!(SUB_TEAM_ANNOUNCEMENT, "SUB_TEAM_ANNOUNCEMENT#", Class::Default);
    topic!(SPACE_COMMON, "SPACE_COMMON", Class::Default);
    topic!(FACT_FOLD_CHAT, "FACT_FOLD_CHAT#", Class::Default);

    // ── Heavy class (slow/expensive: essence indexing, AI, analyze, egress) ──
    // Tokens whose entity fans out to a MIX of fast + heavy rules go here on the
    // heavier rule's account, so a slow essence/AI/vector handler never blocks
    // the Default loop (notifications); the fast rule on the same token (e.g.
    // PopularPostUpdate) just rides the heavy loop, triggered by the same write.
    topic!(POST, "POST", Class::Heavy);
    topic!(POST_COMMENT, "POST_COMMENT#", Class::Heavy);
    topic!(SPACE_POST, "SPACE_POST#", Class::Heavy);
    topic!(SPACE_POST_COMMENT, "SPACE_POST_COMMENT#", Class::Heavy);
    topic!(SPACE_POST_COMMENT_REPLY, "SPACE_POST_COMMENT_REPLY#", Class::Heavy);
    topic!(SPACE_POLL, "SPACE_POLL#", Class::Heavy);
    topic!(SPACE_QUIZ, "SPACE_QUIZ#", Class::Heavy);
    topic!(SPACE_ANALYZE_REPORT, "SPACE_ANALYZE_REPORT#", Class::Heavy);
    topic!(SPACE_ANALYZE_DISCUSSION_RESULT, "SPACE_ANALYZE_DISCUSSION_RESULT#", Class::Heavy);
    topic!(SYNDICATION_JOB, "SYNDICATION_JOB#", Class::Heavy);
}

/// Poll cadence when a class has nothing pending.
const POLL_INTERVAL: Duration = Duration::from_millis(1000);
/// Rows dispatched per class per tick.
const BATCH: i64 = 500;
/// Dispatch attempts before a row is dead-lettered.
const MAX_ATTEMPTS: i32 = 8;
/// Processed rows older than this are reaped (24h).
const RETENTION_MS: i64 = 24 * 60 * 60 * 1000;
/// Reap runs every N `Default` ticks (~ every 5 min at a 1s interval).
const REAP_EVERY_TICKS: u64 = 300;

/// A jsonb-stored entity image.
///
/// Stored as the **DynamoDB-attribute-shaped** JSON of the entity
/// (`serde_dynamo::to_item(entity)` → `serde_json`), NOT the plain entity JSON.
/// This is deliberate: the dispatcher deserializes with `serde_dynamo::from_item`,
/// so the image must be a faithful `serde_dynamo` `Item`. Converting the entity
/// once at emit time and reconstructing the same `Item` at poll time avoids an
/// entity→json→dynamo double hop that mangled number types
/// (`from_item` "Expected num").
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, PostgresJson)]
pub struct EventImage(pub serde_json::Value);

impl EventImage {
    /// Serialize an entity to a DynamoDB-attribute image and wrap it for jsonb
    /// storage. On serialize failure, stores `Null` (logged) — the poller will
    /// dead-letter it rather than the caller's mutation failing.
    fn from_entity<T: Serialize>(v: &T) -> Self {
        match serde_dynamo::to_item::<_, Image>(v) {
            Ok(image) => {
                EventImage(serde_json::to_value(&image).unwrap_or(serde_json::Value::Null))
            }
            Err(e) => {
                crate::error!("outbox: serialize image: {e}");
                EventImage(serde_json::Value::Null)
            }
        }
    }

    /// Reconstruct the `serde_dynamo` image stored by [`from_entity`].
    fn to_image(&self) -> Result<Image> {
        serde_json::from_value(self.0.clone()).map_err(|e| {
            crate::error!("outbox: image from_value: {e}");
            crate::common::Error::from(crate::common::utils::InfraError::StreamDeserializeFailed)
        })
    }
}

/// One outbox entry — the Postgres analogue of a DynamoDB Stream record.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, PostgresEntity)]
#[postgres(table = "event_outbox")]
pub struct EventOutbox {
    #[serde(default)]
    pub id: Uuid,
    /// Emission time (ms). Drain order.
    #[postgres(order)]
    pub created_at: i64,
    /// `"INSERT" | "MODIFY" | "REMOVE"`.
    pub event_name: String,
    /// Routing token the dispatcher rule matches on (see [`topic`]).
    #[postgres(index)]
    pub topic: String,
    /// Dispatch class (`"default"` | `"heavy"`) — selects the poller loop.
    #[serde(default)]
    #[postgres(index)]
    pub event_class: String,
    /// New-state image (INSERT/MODIFY). `None` for REMOVE.
    pub new_image: Option<EventImage>,
    /// Old-state image (MODIFY/REMOVE). `None` for INSERT.
    pub old_image: Option<EventImage>,
    /// `0` = pending; otherwise the dispatch timestamp (ms). A sentinel (not
    /// NULL) keeps the drain a plain indexed equality filter.
    #[serde(default)]
    #[postgres(index)]
    pub processed_at: i64,
    /// Failed dispatch attempts.
    #[serde(default)]
    pub attempts: i32,
    /// `0` = live; otherwise the dead-letter timestamp (ms). Dead-lettered rows
    /// are excluded from the drain so a poison row never blocks the queue.
    #[serde(default)]
    #[postgres(index)]
    pub failed_at: i64,
}

impl EventOutbox {
    // ─── Emit (transactional — the primary, atomic API) ──────────────────

    /// Emit an INSERT event **in the caller's transaction**, so the event is
    /// committed iff the state change is. `topic` carries the routing token and
    /// dispatch class (use a [`topic`] constant).
    pub async fn emit_insert_tx<T: Serialize>(tx: &Tx, topic: Topic, new: &T) -> Result<()> {
        Self::repository()
            .with_tx(tx)
            .insert(&Self::build("INSERT", topic, Some(new), None::<&T>))
            .await?;
        Ok(())
    }

    /// Emit a MODIFY event (both images) in the caller's transaction.
    pub async fn emit_modify_tx<T: Serialize>(
        tx: &Tx,
        topic: Topic,
        old: &T,
        new: &T,
    ) -> Result<()> {
        Self::repository()
            .with_tx(tx)
            .insert(&Self::build("MODIFY", topic, Some(new), Some(old)))
            .await?;
        Ok(())
    }

    /// Emit a REMOVE event (old image) in the caller's transaction.
    pub async fn emit_remove_tx<T: Serialize>(tx: &Tx, topic: Topic, old: &T) -> Result<()> {
        Self::repository()
            .with_tx(tx)
            .insert(&Self::build("REMOVE", topic, None::<&T>, Some(old)))
            .await?;
        Ok(())
    }

    // ─── Emit (best-effort, NON-atomic — only when no tx is available) ────

    /// Best-effort INSERT emit **outside any transaction**. Prefer
    /// [`emit_insert_tx`](Self::emit_insert_tx): if the process dies between the
    /// state write and this insert, the event is lost. A failure is logged, not
    /// propagated, so it never fails the caller's already-committed mutation.
    pub async fn emit_insert<T: Serialize>(topic: Topic, new: &T) -> Result<()> {
        Self::emit_best_effort("INSERT", topic, Some(new), None::<&T>).await
    }

    /// Best-effort MODIFY emit outside any transaction (see [`emit_insert`]).
    pub async fn emit_modify<T: Serialize>(topic: Topic, old: &T, new: &T) -> Result<()> {
        Self::emit_best_effort("MODIFY", topic, Some(new), Some(old)).await
    }

    /// Best-effort REMOVE emit outside any transaction (see [`emit_insert`]).
    pub async fn emit_remove<T: Serialize>(topic: Topic, old: &T) -> Result<()> {
        Self::emit_best_effort("REMOVE", topic, None::<&T>, Some(old)).await
    }

    async fn emit_best_effort<T: Serialize>(
        event_name: &str,
        topic: Topic,
        new: Option<&T>,
        old: Option<&T>,
    ) -> Result<()> {
        let row = Self::build(event_name, topic, new, old);
        if let Err(e) = Self::repository().insert(&row).await {
            crate::error!("outbox: best-effort emit {} {}: {e}", row.event_name, row.topic);
        }
        Ok(())
    }

    fn build<T: Serialize>(
        event_name: &str,
        topic: Topic,
        new: Option<&T>,
        old: Option<&T>,
    ) -> Self {
        EventOutbox {
            id: Uuid::now_v7(),
            created_at: crate::common::utils::time::get_now_timestamp_millis(),
            event_name: event_name.to_string(),
            topic: topic.token.to_string(),
            event_class: topic.class.as_str().to_string(),
            new_image: new.map(EventImage::from_entity),
            old_image: old.map(EventImage::from_entity),
            processed_at: 0,
            attempts: 0,
            failed_at: 0,
        }
    }

    // ─── Dispatch reconstruction ─────────────────────────────────────────

    /// Rebuild the DynamoDB-shaped `CdcEvent` the dispatcher expects: convert the
    /// stored json images to `serde_dynamo` images and inject the `sk` the rules
    /// filter on (`sk = topic`; the images carry no key attributes).
    fn to_cdc_event(&self) -> Result<CdcEvent> {
        let build = |img: &Option<EventImage>| -> Result<Option<Image>> {
            match img {
                None => Ok(None),
                Some(image) => {
                    let mut image = image.to_image()?;
                    image.insert("sk".into(), AttributeValue::S(self.topic.clone()));
                    Ok(Some(image))
                }
            }
        };
        let mut keys = Image::new();
        keys.insert("sk".into(), AttributeValue::S(self.topic.clone()));
        Ok(CdcEvent {
            schema_version: CDC_SCHEMA_VERSION,
            event_name: self.event_name.clone(),
            keys,
            new_image: build(&self.new_image)?,
            old_image: build(&self.old_image)?,
            approximate_creation_ms: Some(self.created_at),
            sequence_number: None,
            source_table: "postgres".to_string(),
        })
    }

    // ─── Drain / mark ────────────────────────────────────────────────────

    async fn drain_batch(class: Class) -> Result<Vec<Self>> {
        use postgres::ops::{NumOp, StringOp};
        Ok(Self::repository()
            .find(
                Self::query()
                    .processed_at(NumOp::Eq(0))
                    .failed_at(NumOp::Eq(0))
                    .event_class(StringOp::Eq(class.as_str().to_string()))
                    .order_by(EventOutboxColumn::CreatedAt, postgres::Order::Asc)
                    .page_size(BATCH),
            )
            .await?
            .items)
    }

    async fn mark_processed(&self) -> Result<()> {
        let now = crate::common::utils::time::get_now_timestamp_millis();
        Self::repository()
            .update(self.id, Self::update().processed_at(now))
            .await?;
        Ok(())
    }

    /// A dispatch failed: bump `attempts`, and dead-letter at `MAX_ATTEMPTS` so
    /// the queue is never blocked by one poison row.
    async fn mark_failed_attempt(&self) -> Result<()> {
        let attempts = self.attempts + 1;
        let mut upd = Self::update().attempts(attempts);
        if attempts >= MAX_ATTEMPTS {
            let now = crate::common::utils::time::get_now_timestamp_millis();
            upd = upd.failed_at(now);
            tracing::error!(
                topic = %self.topic,
                id = %self.id,
                attempts,
                "outbox: DEAD-LETTER after max attempts — side effect dropped, needs manual replay"
            );
        }
        Self::repository().update(self.id, upd).await?;
        Ok(())
    }

    /// Delete processed rows older than the retention window. Returns the count.
    async fn reap() -> Result<u64> {
        use postgres::sqlx;
        let cutoff = crate::common::utils::time::get_now_timestamp_millis() - RETENTION_MS;
        let res = sqlx::query("DELETE FROM event_outbox WHERE processed_at > 0 AND processed_at < $1")
            .bind(cutoff)
            .execute(postgres::global::pool())
            .await
            .map_err(|e| {
                crate::error!("outbox: reap: {e}");
                crate::common::Error::from(crate::common::utils::InfraError::StreamDeserializeFailed)
            })?;
        Ok(res.rows_affected())
    }
}

/// Drain one batch for `class`: dispatch each row; on success mark it processed,
/// on failure bump attempts (dead-letter at the cap) and CONTINUE — never block
/// the queue on a single poison row.
async fn poll_once(class: Class) -> Result<usize> {
    let rows = EventOutbox::drain_batch(class).await?;
    let mut count = 0usize;
    for row in &rows {
        let cdc = match row.to_cdc_event() {
            Ok(c) => c,
            Err(e) => {
                // Unparseable image is itself a poison row.
                tracing::error!(topic = %row.topic, "outbox: to_cdc_event: {e}");
                row.mark_failed_attempt().await?;
                continue;
            }
        };
        let summary = dispatch(&cdc, RoleSet::all()).await;
        if summary.failed.is_empty() {
            row.mark_processed().await?;
            count += 1;
        } else {
            tracing::warn!(
                rules = ?summary.failed,
                topic = %row.topic,
                "outbox: dispatch failed; will retry (poison-isolated)"
            );
            row.mark_failed_attempt().await?;
        }
    }
    Ok(count)
}

/// Acquire the per-class single-processing lock on a dedicated pooled connection.
/// Returns the held connection (keep it alive to hold the lock) or `None`.
async fn acquire_lock(
    class: Class,
) -> Option<postgres::sqlx::pool::PoolConnection<postgres::sqlx::Postgres>> {
    use postgres::sqlx;
    let mut conn = match postgres::global::pool().acquire().await {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("outbox[{}]: acquire connection: {e}", class.as_str());
            return None;
        }
    };
    let got: bool = match sqlx::query_scalar("SELECT pg_try_advisory_lock($1)")
        .bind(class.lock_key())
        .fetch_one(&mut *conn)
        .await
    {
        Ok(v) => v,
        Err(e) => {
            tracing::error!("outbox[{}]: pg_try_advisory_lock: {e}", class.as_str());
            return None;
        }
    };
    if got { Some(conn) } else { None }
}

/// The per-class async loop: hold the lock, then drain forever. Only the
/// `Default` loop reaps (one deleter avoids contention). Returns (so the
/// supervisor retries) if the lock is not acquired.
async fn run_loop(class: Class) {
    let _lock = match acquire_lock(class).await {
        Some(c) => c,
        None => {
            tokio::time::sleep(Duration::from_secs(5)).await;
            return;
        }
    };
    tracing::info!("outbox[{}]: acquired lock, draining", class.as_str());
    let mut ticks: u64 = 0;
    loop {
        match poll_once(class).await {
            Ok(n) if n > 0 => {
                tracing::debug!(class = class.as_str(), dispatched = n, "outbox: batch dispatched")
            }
            Ok(_) => {}
            Err(e) => tracing::error!("outbox[{}]: {e}", class.as_str()),
        }
        ticks += 1;
        if class == Class::Default && ticks % REAP_EVERY_TICKS == 0 {
            match EventOutbox::reap().await {
                Ok(n) if n > 0 => tracing::info!(reaped = n, "outbox: reaped processed rows"),
                Ok(_) => {}
                Err(e) => tracing::error!("outbox: reap: {e}"),
            }
        }
        tokio::time::sleep(POLL_INTERVAL).await;
    }
}

/// Spawn one poller per [`Class`], each on a dedicated OS thread with its own
/// Tokio runtime — `dioxus::serve()` is synchronous and has not started the
/// reactor when this is called, so `tokio::spawn()` here would panic ("no
/// reactor running"). Mirrors `stream_poller::spawn_stream_poller`.
pub fn spawn_outbox_poller() {
    for class in Class::ALL {
        std::thread::Builder::new()
            .name(format!("outbox-{}", class.as_str()))
            .spawn(move || {
                let rt = tokio::runtime::Builder::new_current_thread()
                    .enable_all()
                    .build()
                    .expect("outbox poller runtime");
                // Supervisor: run_loop returns (lock not held) or panics (a
                // poison handler unwinding); restart so the poller self-heals.
                loop {
                    let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                        rt.block_on(run_loop(class));
                    }));
                    match outcome {
                        Ok(()) => tracing::debug!(
                            "outbox[{}]: loop returned; retrying in 5s",
                            class.as_str()
                        ),
                        Err(_) => tracing::error!(
                            "outbox[{}]: panicked; restarting in 5s",
                            class.as_str()
                        ),
                    }
                    std::thread::sleep(Duration::from_secs(5));
                }
            })
            .expect("failed to spawn outbox poller thread");
    }
}
