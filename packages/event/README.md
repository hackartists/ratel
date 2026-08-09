# event

A tiny event bus for Rust services over Redpanda / Kafka (`rdkafka`). One `#[event]`
attribute turns an `async fn` into **either** a Kafka **consumer** (in the service that
owns the handler) **or** a typed **producer client** (in any other crate) — the choice is
a cargo feature, the same inversion `ts-server-fn` does for HTTP handlers.

- `#[event]` on `async fn <service>_<event>(payload) -> Result<(), E>`
- Topic `= {env}.{service}.{data}.v{version}`, composed at compile time
- `server` feature **on** → consumer (auto-registered via `inventory`, run by `event::run()`)
- `server` feature **off** → a `event::produce`-backed producer client with the **same name**
- At-least-once delivery; **handlers must be idempotent**

---

## Define an event

```rust
use event::event;
use serde::{Deserialize, Serialize};

// Payload: one Serialize + DeserializeOwned argument, a simple identifier (not a pattern).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignupData {
    pub email: String,
    pub name: String,
}

#[event] // topic: {env}.dataroom.signup.v1
pub async fn dataroom_signup(req: SignupData) -> Result<(), MyError> {
    // ... do the work (render + send, write a row, call an API) ...
    Ok(())
}
```

- The handler **name is split on the first `_`**: `dataroom_signup` → service `dataroom`, data `signup`.
- The error type must be `Display` (e.g. a `thiserror` enum) — the consumer maps it to a log line.
- The fn must be `async` and take exactly one payload argument. Violations are **compile errors**.

### Attributes & the topic scheme

Every part is optional and overridable:

```rust
#[event(service = "dataroom", env = "prod", data = "signup", version = 2)] // prod.dataroom.signup.v2
```

| part | default |
|------|---------|
| `env` | `option_env!("ENV")` at compile time, else `"dev"` |
| `service` | handler name **before** the first `_` |
| `data` | handler name **after** the first `_` |
| `version` | `1` |

Topic = `{env}.{service}.{data}.v{version}`. The `env` is baked at **compile time**, so a
producer and its consumer must be built under the **same `ENV`** to agree on the topic.
Malformed attribute values (`version = "2"`, an unknown key, …) are compile errors — the
topic is the whole producer↔consumer contract, so it never fails silently.

---

## Produce events (from any Rust crate)

Depend on the crate that **owns** the handlers with `default-features = false`, so its
`#[event]` fns compile as producer clients rather than consumers:

```toml
# in the producer crate's Cargo.toml
notification = { path = "../server-apps/notification", default-features = false }
```

```rust
// same name as the handler; returns Result<(), event::Error>
notification::dataroom_signup(SignupData { email, name }).await?;
```

`produce` publishes a JSON body, **unkeyed** (round-robin partitioning), best-effort /
fire-and-forget with a bounded send timeout. If you need transactional delivery, route the
serialized event through your own outbox instead of calling the client directly.

---

## Run the consumer (the owning service)

The service crate turns on the `server` feature (usually its `default`). `event::run()`
builds a `StreamConsumer`, subscribes to every registered topic, and dispatches each
message to its handler:

```rust
#[tokio::main]
async fn main() {
    tracing_subscriber::fmt().init();

    // Reference each handler once so the linker keeps its `inventory::submit!`
    // (dead-code elimination drops registrations nothing refers to).
    my_crate::events::link();

    // Returns Err only on a *fatal* Kafka client error; transient errors are retried
    // internally by librdkafka.
    if let Err(e) = event::run().await {
        tracing::error!(error = %e, "consumer exited");
        std::process::exit(1); // let the supervisor (e.g. ECS) restart us
    }
}
```

Delivery semantics:

- **At-least-once** — an offset is committed only after the handler returns `Ok`.
- **Idempotent handlers required** — redelivery and `auto.offset.reset = earliest` replay are possible.
- **Panic isolation** — a panicking handler fails only its message, not the whole loop.
- **Fatal-error exit** — a fatal client error returns `Err` so a supervisor restarts the process.
- **Duplicate topics** are rejected at startup (two handlers can't claim the same topic).

The `link()` helper is a convention, not magic — it's just a function that references each
handler so the module is linked:

```rust
// my_crate/src/events/mod.rs
pub mod dataroom;

#[cfg(feature = "server")]
pub fn link() {
    let _ = dataroom::dataroom_signup;
    // add one line per handler
}
```

---

## Cargo & workspace setup for a consumer crate

```toml
[dependencies]
event = { path = "../../packages/event", default-features = false }

[features]
default = ["server"]
server = ["event/server" /*, your aws/template/etc deps */]

[[bin]]
name = "my-service"
required-features = ["server"]
```

**Keep the consumer crate OUT of the root cargo workspace** — give it its own empty
`[workspace]` table and add it to the root `Cargo.toml` `workspace.exclude`. Otherwise cargo
**feature unification** turns `server` on for it in `cargo build --workspace`, which flips
every producer that depends on it into the consumer build (their producer client gets
`cfg`'d out). Excluded, it is only ever pulled as a `default-features = false` path dep
(server off → producer client); build the service itself standalone (`cd <crate> && cargo build`,
default `server` on). This mirrors the repo's `services/*` workers.

---

## Configuration (environment)

| var | read by | default |
|-----|---------|---------|
| `REDPANDA_BROKERS` | producer + consumer | `127.0.0.1:9092` |
| `EVENT_GROUP_ID` | consumer | `notification` |
| `ENV` | compile-time topic prefix (`option_env!`) | `dev` |

---

## Crate surface

| item | feature | what |
|------|---------|------|
| `#[event]` | always | attribute macro (re-exported from `event-macros`) |
| `event::produce(topic, &payload)` | always | low-level JSON publish (the producer client calls this) |
| `event::Error` | always | crate error enum |
| `event::run()` | `server` | the consumer loop |
| `event::EventConsumer` + `event::inventory` | `server` | the registry the macro submits handlers to |
