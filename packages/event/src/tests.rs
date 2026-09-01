#![cfg(test)]

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, PartialEq, Debug)]
struct Ping {
    n: u32,
}

#[test]
fn error_from_serde_is_serde_variant() {
    let bad: Result<Ping, _> = event::from_slice(b"not json");
    let err = bad.unwrap_err();
    assert!(matches!(err, event::Error::Serde(_)), "got {err:?}");
}

#[cfg(feature = "server")]
#[test]
fn event_consumer_struct_is_constructible() {
    fn topic() -> String {
        "test.demo.ping.v1".to_string()
    }
    fn dispatch(_bytes: Vec<u8>) -> event::BoxFuture<'static, Result<(), event::Error>> {
        event::boxed(async { Ok(()) })
    }
    let c = event::EventConsumer { topic, dispatch };
    assert_eq!((c.topic)(), "test.demo.ping.v1");
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct Signup {
    pub email: String,
}

// Name splits on first '_': service = "dataroom", data = "signup".
// env pinned to "test" so the topic is deterministic regardless of the
// process's runtime ENV.
#[event::event(env = "test")]
#[allow(dead_code)]
pub async fn dataroom_signup(req: Signup) -> Result<(), event::Error> {
    let _ = req;
    Ok(())
}

// A handler named `noservice` (no `_`) without explicit service/data must fail to
// compile with the macro's error message. Do not add such a handler here.

#[test]
fn topic_is_composed_from_name_split() {
    assert_eq!(__dataroom_signup_topic(), "test.dataroom.signup.v1");
}

#[cfg(feature = "server")]
#[test]
fn server_build_registers_a_consumer() {
    let topics: Vec<String> = event::inventory::iter::<event::EventConsumer>()
        .map(|c| (c.topic)())
        .collect();
    assert!(
        topics.contains(&"test.dataroom.signup.v1".to_string()),
        "registered topics: {topics:?}"
    );
}

#[cfg(not(feature = "server"))]
#[tokio::test]
async fn producer_build_exposes_same_named_client() {
    // In producer builds the macro drops the body and emits `dataroom_signup`
    // as a publish client. We only assert it type-checks + is callable; with no
    // broker the send errors, which is fine here.
    let _ = dataroom_signup(Signup {
        email: "a@b.c".into(),
    })
    .await;
}

// ── key = "field" (keyed producer) ──────────────────────────────────

#[derive(serde::Serialize, serde::Deserialize)]
pub struct Scored {
    pub dataroom_id: String,
    pub score: u32,
}

// `key = "dataroom_id"`: the producer expansion publishes via
// `produce_keyed(topic, &payload.dataroom_id.to_string(), &payload)`.
// env pinned to "test" so the topic is deterministic.
#[event::event(env = "test", key = "dataroom_id")]
#[allow(dead_code)]
pub async fn dataroom_scored(req: Scored) -> Result<(), event::Error> {
    let _ = req;
    Ok(())
}

#[test]
fn keyed_event_topic_is_composed_from_name_split() {
    // The `key` attribute must not disturb topic derivation.
    assert_eq!(__dataroom_scored_topic(), "test.dataroom.scored.v1");
}

#[cfg(feature = "server")]
#[test]
fn keyed_event_registers_a_consumer() {
    let topics: Vec<String> = event::inventory::iter::<event::EventConsumer>()
        .map(|c| (c.topic)())
        .collect();
    assert!(
        topics.contains(&"test.dataroom.scored.v1".to_string()),
        "registered topics: {topics:?}"
    );
}

#[cfg(not(feature = "server"))]
#[tokio::test]
async fn keyed_producer_build_exposes_same_named_client() {
    // Producer mode: the macro emits `dataroom_scored` as a keyed publish
    // client (`produce_keyed` with the stringified `dataroom_id`). We only
    // assert it type-checks + is callable; with no broker the send errors,
    // which is fine here.
    let _ = dataroom_scored(Scored {
        dataroom_id: "room-1".into(),
        score: 42,
    })
    .await;
}
