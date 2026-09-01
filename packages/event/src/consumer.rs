use std::collections::{HashMap, VecDeque};

use futures::StreamExt;
use futures::stream::FuturesUnordered;
use rdkafka::TopicPartitionList;
use rdkafka::admin::{AdminClient, AdminOptions, NewTopic, TopicReplication};
use rdkafka::client::DefaultClientContext;
use rdkafka::consumer::{CommitMode, Consumer, StreamConsumer};
use rdkafka::message::{BorrowedMessage, Message};
use rdkafka::types::RDKafkaErrorCode;

use crate::BoxFuture;
use crate::config;
use crate::error::Error;

/// A single partition's identity — the unit of pause/resume, in-flight
/// serialization, and offset commits.
type PartitionKey = (String, i32);

/// Completion of a spawned handler: which partition it served + the join
/// result (`Err` = the handler panicked / was aborted).
type HandlerDone = (
    PartitionKey,
    Result<Result<(), Error>, tokio::task::JoinError>,
);

/// One registered event handler. Auto-collected via `inventory`, mirroring how
/// `ts-server-fn-axum` collects routes.
pub struct EventConsumer {
    /// Composed topic (`{env}.{service}.{data}.v{version}`), computed at runtime
    /// from compile-time parts by the `#[event]` macro.
    pub topic: fn() -> String,
    /// Deserialize the body and run the handler.
    pub dispatch: fn(Vec<u8>) -> BoxFuture<'static, Result<(), Error>>,
}

inventory::collect!(EventConsumer);

/// Subscribe to every registered topic and dispatch messages. Runs until the
/// process exits or a fatal Kafka client error occurs (transient errors are
/// retried by librdkafka; graceful cancellation is a follow-up). Handlers must
/// be idempotent — delivery is at-least-once.
///
/// Poll and handler execution are decoupled with **partition-level
/// pause/resume**: while a handler runs, only its (topic, partition) is
/// paused, so handlers for different partitions/topics run concurrently
/// (bounded by the number of assigned partitions) while the loop keeps
/// polling — rebalance callbacks are served promptly and librdkafka's
/// default `max.poll.interval.ms` is safe. Within a partition, exactly one
/// message is in flight at a time, so ordering and `commit_message`
/// semantics are unchanged (offsets are per-partition).
///
/// On SIGTERM/SIGINT the loop stops recv-ing, drains in-flight handlers
/// within `EVENT_SHUTDOWN_GRACE_SECS` (committing completed ones), and
/// returns `Ok(())` so the `StreamConsumer` is dropped — the drop sends the
/// consumer close/LeaveGroup, letting the group rebalance immediately
/// instead of waiting out `session.timeout.ms` for a dead member.
pub async fn run() -> Result<(), Error> {
    let mut registry: HashMap<String, &'static EventConsumer> = HashMap::new();
    for c in inventory::iter::<EventConsumer>() {
        let topic = (c.topic)();
        if registry.insert(topic.clone(), c).is_some() {
            return Err(Error::Consumer(format!(
                "duplicate event consumer registered for topic {topic}"
            )));
        }
    }
    if registry.is_empty() {
        tracing::warn!("event: no consumers registered; run() is idle");
    }

    let consumer: StreamConsumer = rdkafka::ClientConfig::new()
        .set("bootstrap.servers", config::brokers())
        .set("group.id", config::group_id())
        .set("enable.auto.commit", "false")
        // earliest: first run / after offset expiry replays a topic from the start,
        // so handlers must be idempotent (also required by at-least-once delivery).
        .set("auto.offset.reset", "earliest")
        // No `max.poll.interval.ms` override: the loop below keeps polling
        // (recv) while handlers run — each handler is spawned as a task and
        // its partition is paused — so long-running handlers (e.g.
        // evaluation's assessment sweep) no longer starve the poll interval,
        // and librdkafka's default (5 min) is safe. Rebalances therefore
        // complete promptly instead of waiting for an in-flight handler.
        .create()
        .map_err(|e| Error::Consumer(e.to_string()))?;

    let topics: Vec<&str> = registry.keys().map(String::as_str).collect();
    // Subscribing to a topic that doesn't exist yet is a fatal
    // UnknownTopicOrPartition on brokers without auto-create (our local
    // Redpanda) — and whether producer or consumer boots first is a race.
    // Create the missing ones up front; already-existing topics are a no-op.
    ensure_topics(&topics).await;
    consumer
        .subscribe(&topics)
        .map_err(|e| Error::Consumer(e.to_string()))?;
    tracing::info!(?topics, "event: subscribed");

    // Partition-level poll/handler separation:
    //
    //   1. recv(msg) → `pause()` only that message's (topic, partition) —
    //      other partitions/topics keep flowing.
    //   2. spawn the handler as a task and KEEP polling (recv) — paused
    //      partitions deliver nothing, but polling keeps serving rebalance
    //      callbacks and protocol events, so `max.poll.interval.ms` never
    //      trips and rebalances complete without waiting for a handler.
    //      Handlers for different partitions run concurrently; the natural
    //      concurrency bound is the number of assigned partitions.
    //   3. on completion: commit on success (same semantics as before —
    //      failure/panic is logged and NOT committed). If a message for that
    //      partition leaked past the pause (prefetch race), process it next
    //      (partition stays paused); otherwise `resume()` the partition.
    //
    // Per-partition serialization is what keeps `commit_message` safe with no
    // extra offset bookkeeping: offsets are per-partition, and at most one
    // message per partition is in flight, so a commit can never overtake an
    // earlier uncommitted message of the same partition.
    //
    // `pending` absorbs the prefetch race: a message of the paused partition
    // that was already dequeued before `pause()` took effect. It stays tiny
    // (0–1 per partition in practice); a queue rather than a single slot so a
    // burst can never force us to drop an already-delivered message (a
    // dropped message would be skipped until the next rebalance/restart).
    //
    // In-flight state: `busy` holds the message being processed per partition
    // (commit target + busy marker); `in_flight` yields handler completions.
    let mut busy: HashMap<PartitionKey, BorrowedMessage<'_>> = HashMap::new();
    let mut pending: HashMap<PartitionKey, VecDeque<BorrowedMessage<'_>>> = HashMap::new();
    let mut in_flight: FuturesUnordered<BoxFuture<'static, HandlerDone>> = FuturesUnordered::new();

    // Spawning isolates a panicking handler (it surfaces as a JoinError
    // instead of unwinding through the poll loop).
    let spawn_handler = |in_flight: &mut FuturesUnordered<BoxFuture<'static, HandlerDone>>,
                         c: &'static EventConsumer,
                         key: PartitionKey,
                         body: Vec<u8>| {
        let handle = tokio::spawn((c.dispatch)(body));
        in_flight.push(Box::pin(async move { (key, handle.await) }));
    };

    // Process-wide shutdown token (`crate::shutdown`) — cancelled on
    // SIGTERM (k8s rolling deploy) / SIGINT (local ctrl-c). The same token
    // drains the process's HTTP surfaces, so one signal shuts the whole
    // service down coherently.
    let shutdown = crate::shutdown::token();

    loop {
        tokio::select! {
            // Shutdown requested: stop recv-ing and fall through to the drain.
            _ = shutdown.cancelled() => break,

            // A handler finished: commit on success, then either run the
            // partition's pending message or resume the partition.
            Some((key, outcome)) = in_flight.next() => {
                settle_completion(&consumer, &mut busy, &key, outcome);
                let (topic, partition) = &key;

                // Prefetch leaked past the pause? Keep the partition paused and
                // process the buffered message next (preserves in-partition order).
                let next = pending.get_mut(&key).and_then(VecDeque::pop_front);
                if let Some(next_msg) = next {
                    if let Some(c) = registry.get(topic.as_str()) {
                        let body = next_msg.payload().unwrap_or_default().to_vec();
                        spawn_handler(&mut in_flight, c, key.clone(), body);
                        busy.insert(key, next_msg);
                    } else {
                        tracing::warn!(%topic, partition, "event: pending message on unsubscribed topic; skipping");
                        resume_partition(&consumer, topic, *partition)?;
                    }
                } else {
                    pending.remove(&key);
                    // Resuming a partition revoked by a rebalance is a no-op
                    // (per-partition states don't error here — see
                    // resume_partition); a real client failure exits via `?`.
                    resume_partition(&consumer, topic, *partition)?;
                }
            }

            // A new message arrived: pause its partition and spawn its handler,
            // or buffer it if that partition already has a handler in flight.
            r = consumer.recv() => match r {
                Ok(msg) => {
                    let topic = msg.topic().to_string();
                    let partition = msg.partition();
                    let Some(c) = registry.get(&topic) else {
                        tracing::warn!(%topic, "event: message on unsubscribed topic; skipping");
                        continue;
                    };
                    let key: PartitionKey = (topic, partition);
                    if busy.contains_key(&key) {
                        // Prefetch race: this partition is paused-with-handler
                        // already — hold the message for after completion.
                        pending.entry(key).or_default().push_back(msg);
                        continue;
                    }
                    // Pause only this partition. A pause failure is fail-fast:
                    // without the pause backpressure the "one in-flight per
                    // partition" invariant degrades into unbounded `pending`
                    // growth, so exit with Err — the normal return path still
                    // drops the consumer (LeaveGroup) and the supervisor
                    // restarts us; uncommitted messages are redelivered.
                    let mut tpl = TopicPartitionList::new();
                    tpl.add_partition(&key.0, partition);
                    if let Err(e) = consumer.pause(&tpl) {
                        tracing::error!(topic = %key.0, partition, error = %e, "event: pause failed; exiting for supervisor restart");
                        return Err(Error::Consumer(format!(
                            "pause failed for {}[{partition}]: {e}",
                            key.0
                        )));
                    }
                    let body = msg.payload().unwrap_or_default().to_vec();
                    spawn_handler(&mut in_flight, c, key.clone(), body);
                    busy.insert(key, msg);
                }
                Err(e) => {
                    tracing::error!(error = %e, "event: recv failed");
                    // Exit on a fatal client error so the process supervisor
                    // (k8s) restarts us; transient errors are retried
                    // internally by librdkafka. In-flight messages are simply
                    // not committed and will be redelivered after restart.
                    if let Some((code, reason)) = consumer.client().fatal_error() {
                        return Err(Error::Consumer(format!(
                            "fatal kafka error {code:?}: {reason}"
                        )));
                    }
                }
            },
        }
    }

    // ── Graceful shutdown ──
    // Drain in-flight handlers within the grace budget: completed handlers
    // are committed as usual; anything still running when the budget expires
    // is abandoned WITHOUT committing — the message is redelivered after the
    // rebalance and absorbed by handler idempotency (at-least-once contract).
    // Then return normally so `consumer` is dropped: the drop closes the
    // consumer and sends LeaveGroup, letting the group rebalance immediately
    // instead of waiting out `session.timeout.ms` for a dead member. (Never
    // `std::process::exit` here — it skips Drop and thus the LeaveGroup.)
    let grace = std::time::Duration::from_secs(config::shutdown_grace_secs());
    tracing::info!(
        in_flight = in_flight.len(),
        grace_secs = grace.as_secs(),
        "event: shutdown requested; draining in-flight handlers"
    );
    let deadline = tokio::time::Instant::now() + grace;
    while !in_flight.is_empty() {
        match tokio::time::timeout_at(deadline, in_flight.next()).await {
            Ok(Some((key, outcome))) => settle_completion(&consumer, &mut busy, &key, outcome),
            Ok(None) => break,
            Err(_elapsed) => {
                tracing::warn!(
                    abandoned = in_flight.len(),
                    "event: shutdown grace expired; abandoning in-flight handlers (uncommitted → redelivered; handlers are idempotent)"
                );
                break;
            }
        }
    }
    tracing::info!("event: closing consumer (LeaveGroup on drop)");
    Ok(())
}

/// Settle a finished handler for `key`: commit its message on success; log
/// (and do NOT commit) on handler error, panic, or task failure — unchanged
/// commit semantics from the pre-pause/resume loop.
fn settle_completion<'a>(
    consumer: &'a StreamConsumer,
    busy: &mut HashMap<PartitionKey, BorrowedMessage<'a>>,
    key: &PartitionKey,
    outcome: Result<Result<(), Error>, tokio::task::JoinError>,
) {
    let (topic, partition) = key;
    let Some(msg) = busy.remove(key) else {
        tracing::error!(%topic, partition, "event: completion for unknown in-flight partition");
        return;
    };
    match outcome {
        Ok(Ok(())) => {
            if let Err(e) = consumer.commit_message(&msg, CommitMode::Async) {
                // A mid-handler rebalance may have revoked the partition —
                // log and move on; the message is redelivered elsewhere and
                // handlers are idempotent.
                tracing::warn!(%topic, partition, error = %e, "event: commit failed");
            }
        }
        Ok(Err(e)) => tracing::error!(%topic, partition, error = %e, "event: dispatch failed"),
        Err(join_err) if join_err.is_panic() => {
            tracing::error!(%topic, partition, "event: dispatch panicked; not committing");
        }
        Err(join_err) => {
            tracing::error!(%topic, partition, error = %join_err, "event: dispatch task failed; not committing");
        }
    }
}

/// Resume a single (topic, partition). Resuming an unpaused or
/// already-revoked partition is harmless — rdkafka's `resume()` only errors
/// on an overall client failure (per-partition states ride inside the TPL) —
/// but an actual failure would leave the partition paused forever (no
/// further delivery until a rebalance), so it is fail-fast: return `Err` and
/// let `run()` exit for a supervisor restart (the normal return path drops
/// the consumer → LeaveGroup; uncommitted messages are redelivered).
fn resume_partition(consumer: &StreamConsumer, topic: &str, partition: i32) -> Result<(), Error> {
    let mut tpl = TopicPartitionList::new();
    tpl.add_partition(topic, partition);
    consumer.resume(&tpl).map_err(|e| {
        tracing::error!(%topic, partition, error = %e, "event: resume failed; exiting for supervisor restart");
        Error::Consumer(format!("resume failed for {topic}[{partition}]: {e}"))
    })
}

/// Ensure every subscribed topic exists with (at least) the desired partition
/// count (`EVENT_TOPIC_PARTITIONS`, default 1; replication stays 1 — fine for
/// the single-node Redpanda). **Grow-only**: a missing topic is created with
/// the desired count, an existing topic with fewer partitions is grown via
/// `create_partitions`, and an existing topic with MORE partitions is only
/// logged — Kafka cannot shrink a topic. Best-effort by design:
/// `TopicAlreadyExists` is the normal case, and any other failure is logged
/// but does NOT abort the consumer — on a managed cluster topics are
/// provisioned out-of-band (the admin API may even be restricted), and the
/// subscribe that follows must still get its chance.
async fn ensure_topics(topics: &[&str]) {
    let partitions = config::topic_partitions();
    let admin: AdminClient<DefaultClientContext> = match rdkafka::ClientConfig::new()
        .set("bootstrap.servers", config::brokers())
        .create()
    {
        Ok(admin) => admin,
        Err(e) => {
            tracing::warn!(error = %e, "event: admin client init failed; skipping topic creation");
            return;
        }
    };

    let new_topics: Vec<NewTopic> = topics
        .iter()
        .map(|t| NewTopic::new(t, partitions, TopicReplication::Fixed(1)))
        .collect();
    match admin.create_topics(&new_topics, &AdminOptions::new()).await {
        Ok(results) => {
            for result in results {
                match result {
                    Ok(topic) => {
                        tracing::info!(%topic, partitions, "event: created missing topic");
                    }
                    Err((topic, RDKafkaErrorCode::TopicAlreadyExists)) => {
                        grow_topic_partitions(&admin, &topic, partitions).await;
                    }
                    Err((topic, code)) => {
                        tracing::warn!(%topic, ?code, "event: topic creation failed");
                    }
                }
            }
        }
        Err(e) => tracing::warn!(error = %e, "event: create_topics request failed"),
    }
}

/// Grow an existing topic to `desired` partitions when it currently has
/// fewer (the grow-only half of `ensure_topics`). Kafka assigns NEW keys to
/// the new partitions but never moves old ones, so per-key ordering is
/// preserved for messages produced after the grow; consumers pick the change
/// up on their next metadata refresh/rebalance — operationally this happens
/// at consumer (re)start. A topic with MORE partitions than desired is left
/// alone (shrinking is impossible) and logged.
async fn grow_topic_partitions(
    admin: &AdminClient<DefaultClientContext>,
    topic: &str,
    desired: i32,
) {
    use rdkafka::admin::NewPartitions;

    let current = match admin
        .inner()
        .fetch_metadata(Some(topic), std::time::Duration::from_secs(5))
    {
        Ok(metadata) => match metadata.topics().first() {
            Some(t) => t.partitions().len() as i32,
            None => {
                tracing::warn!(%topic, "event: metadata returned no topic; skipping partition check");
                return;
            }
        },
        Err(e) => {
            tracing::warn!(%topic, error = %e, "event: fetch_metadata failed; skipping partition check");
            return;
        }
    };

    if current >= desired {
        if current > desired {
            tracing::info!(
                %topic,
                current,
                desired,
                "event: topic has more partitions than EVENT_TOPIC_PARTITIONS; leaving as-is (Kafka cannot shrink)"
            );
        }
        return;
    }

    let request = [NewPartitions::new(topic, desired as usize)];
    match admin
        .create_partitions(&request, &AdminOptions::new())
        .await
    {
        Ok(results) => {
            for result in results {
                match result {
                    Ok(topic) => {
                        tracing::info!(%topic, from = current, to = desired, "event: grew topic partitions");
                    }
                    Err((topic, code)) => {
                        tracing::warn!(%topic, ?code, "event: create_partitions failed");
                    }
                }
            }
        }
        Err(e) => tracing::warn!(%topic, error = %e, "event: create_partitions request failed"),
    }
}
