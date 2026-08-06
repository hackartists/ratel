use std::sync::OnceLock;
use std::time::Duration;

use rdkafka::producer::{FutureProducer, FutureRecord};
use rdkafka::util::Timeout;
use serde::Serialize;

use crate::config;
use crate::error::Error;

static PRODUCER: OnceLock<FutureProducer> = OnceLock::new();

fn producer() -> Result<&'static FutureProducer, Error> {
    if let Some(p) = PRODUCER.get() {
        return Ok(p);
    }
    let p = rdkafka::ClientConfig::new()
        .set("bootstrap.servers", config::brokers())
        .set("message.timeout.ms", "5000")
        .create()
        .map_err(|e| Error::Produce(e.to_string()))?;
    let _ = PRODUCER.set(p); // lost a race → our `p` is dropped; the winner is stored
    Ok(PRODUCER
        .get()
        .expect("producer set above or by the race winner"))
}

/// Serialize `payload` as JSON and publish it to `topic`.
///
/// Messages are published **unkeyed** — librdkafka round-robins them across the
/// topic's partitions, so there is no per-key ordering guarantee. Events that
/// need per-entity ordering use [`produce_keyed`] (the `#[event(key = "…")]`
/// attribute routes through it).
pub async fn produce<T: Serialize>(topic: &str, payload: &T) -> Result<(), Error> {
    send(topic, None, payload).await
}

/// Serialize `payload` as JSON and publish it to `topic` with a **message
/// key**: Kafka hashes the key to a partition, so all messages with the same
/// key land on the same partition and keep their order — the per-entity
/// serialization contract on multi-partition topics. Pass the entity-scope
/// id (dataroom_id / content_id / workspace_id / …) as the key.
pub async fn produce_keyed<T: Serialize>(topic: &str, key: &str, payload: &T) -> Result<(), Error> {
    send(topic, Some(key), payload).await
}

async fn send<T: Serialize>(topic: &str, key: Option<&str>, payload: &T) -> Result<(), Error> {
    let body = serde_json::to_vec(payload)?;
    let mut record: FutureRecord<'_, str, [u8]> = FutureRecord::to(topic).payload(&body);
    if let Some(key) = key {
        record = record.key(key);
    }
    producer()?
        .send(record, Timeout::After(Duration::from_secs(5)))
        .await
        .map_err(|(e, _)| {
            tracing::error!(%topic, error = %e, "event: produce failed");
            Error::Produce(e.to_string())
        })?;
    Ok(())
}
