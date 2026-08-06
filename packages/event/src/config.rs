/// Redpanda/Kafka brokers, from `REDPANDA_BROKERS` (default local).
pub fn brokers() -> String {
    std::env::var("REDPANDA_BROKERS").unwrap_or_else(|_| "127.0.0.1:9092".to_string())
}

#[cfg(feature = "server")]
/// Consumer group id, from `EVENT_GROUP_ID` (default `notification`).
pub fn group_id() -> String {
    std::env::var("EVENT_GROUP_ID").unwrap_or_else(|_| "notification".to_string())
}

#[cfg(feature = "server")]
/// Desired partition count for every event topic, from
/// `EVENT_TOPIC_PARTITIONS` (default `1` — local/PR stacks; prod raises it via
/// the helm commonEnv). Grow-only semantics live in `ensure_topics`: a missing
/// topic is created with this many partitions, an existing topic with fewer is
/// grown via the admin API, and an existing topic with MORE partitions is left
/// alone (Kafka cannot shrink a topic) with a log line.
pub fn topic_partitions() -> i32 {
    std::env::var("EVENT_TOPIC_PARTITIONS")
        .ok()
        .and_then(|v| v.parse::<i32>().ok())
        .filter(|n| *n >= 1)
        .unwrap_or(1)
}

#[cfg(feature = "server")]
/// Graceful-shutdown budget for in-flight handlers on SIGTERM/SIGINT, from
/// `EVENT_SHUTDOWN_GRACE_SECS` (default 20s — inside k8s'
/// terminationGracePeriodSeconds of 30s, leaving headroom for the consumer
/// close/LeaveGroup that follows).
pub fn shutdown_grace_secs() -> u64 {
    std::env::var("EVENT_SHUTDOWN_GRACE_SECS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(20)
}
