//! In-process, stale-while-revalidate SSR response cache for anonymous
//! space-viewer page GETs.
//!
//! `GET /spaces/**` server-renders a *viewer-independent* shell for anonymous
//! visitors: the space cards (poll/quiz/discussion/apps/…) load client-side
//! after hydration, and the SSR HTML was verified to carry no per-user data and
//! no `Set-Cookie`. Under load every anonymous hit re-renders that identical
//! shell, so throughput is capped by render cost (~1k rps on 2 pods).
//!
//! This layer memoizes the rendered `200 text/html` response per request path
//! and replays it from memory. To keep a fixed TTL from producing a render
//! *stampede* every time the entry expires (the burst that leaves a small tail
//! of >30s responses under heavy concurrency), it serves **stale-while-
//! revalidate**: once past the soft TTL a request still gets the cached bytes
//! instantly, and only a *single* request per key re-renders in place. So even
//! at expiry there is at most one render, never a burst.
//!
//! ## Safety (why this can't leak sessions or serve the wrong shell)
//! - Caches ONLY `GET`, ONLY paths under `/spaces/`, and ONLY when NO session
//!   cookie is present. The session cookie is `{env}_sid` (see `session_layer`),
//!   so any `…_sid=` in the Cookie header marks a logged-in request that ALWAYS
//!   bypasses — the anonymous cache can never store or serve a logged-in
//!   (per-user) shell, and vice-versa.
//! - Stores ONLY `200 text/html` bodies. Non-200, non-HTML, and every `/api/**`
//!   or streaming response flow straight through untouched (never buffered).
//! - Replays the render's ORIGINAL headers (Content-Type, Strict-Transport-
//!   Security, Vary, …) on every hit, minus per-connection / per-response ones
//!   (Set-Cookie, Content-Length, hop-by-hop) — so a cache hit is not stripped
//!   of the security headers the live render carried.
//! - Sits OUTSIDE the session layer, so a cache hit skips session lookup; it
//!   emits `x-ssr-cache: HIT | STALE | MISS` for verification.

#[cfg(feature = "server")]
use std::collections::HashMap;
#[cfg(feature = "server")]
use std::sync::atomic::{AtomicBool, Ordering};
#[cfg(feature = "server")]
use std::sync::{OnceLock, RwLock};
#[cfg(feature = "server")]
use std::time::{Duration, Instant};

#[cfg(feature = "server")]
use crate::axum::http::{HeaderName, HeaderValue};

/// Fresh window: within this a request gets the cached bytes verbatim (`HIT`).
#[cfg(feature = "server")]
const TTL: Duration = Duration::from_secs(10);
/// Stale window past `TTL`: bytes are still served (`STALE`) while one request
/// re-renders. Beyond `TTL + STALE_GRACE` the entry is treated as cold.
#[cfg(feature = "server")]
const STALE_GRACE: Duration = Duration::from_secs(300);
/// Soft cap on distinct cached paths; on overflow we sweep hard-expired entries.
#[cfg(feature = "server")]
const MAX_ENTRIES: usize = 2_000;
/// Upper bound when buffering a cacheable body (SSR shells are ~20–60 KiB).
#[cfg(feature = "server")]
const MAX_BODY: usize = 4 * 1024 * 1024;

/// Headers we must NOT replay from a stored response: `Set-Cookie` (never cache
/// a per-response cookie), `Content-Length` (axum recomputes it from the body),
/// the hop-by-hop headers, `Age`, and our own marker.
#[cfg(feature = "server")]
fn skip_header(name: &HeaderName) -> bool {
    // HeaderName always stores its name lowercased, so a str compare is exact.
    matches!(
        name.as_str(),
        "set-cookie"
            | "content-length"
            | "transfer-encoding"
            | "connection"
            | "age"
            | "x-ssr-cache"
    )
}

#[cfg(feature = "server")]
struct Entry {
    /// Fresh until this instant; stale-servable until `soft_expires + STALE_GRACE`.
    soft_expires: Instant,
    /// True while exactly one request is re-rendering this key.
    refreshing: AtomicBool,
    /// The render's replayable headers (see [`skip_header`]).
    headers: Vec<(HeaderName, HeaderValue)>,
    body: Vec<u8>,
}

#[cfg(feature = "server")]
static CACHE: OnceLock<RwLock<HashMap<String, Entry>>> = OnceLock::new();

#[cfg(feature = "server")]
fn cache() -> &'static RwLock<HashMap<String, Entry>> {
    CACHE.get_or_init(|| RwLock::new(HashMap::new()))
}

/// Anonymous = no `…_sid` session cookie on the request.
#[cfg(feature = "server")]
fn is_anonymous(req: &crate::axum::extract::Request) -> bool {
    match req
        .headers()
        .get(crate::axum::http::header::COOKIE)
        .and_then(|v| v.to_str().ok())
    {
        Some(cookie) => !cookie.contains("_sid="),
        None => true,
    }
}

/// What the cache lookup decided for this request.
#[cfg(feature = "server")]
enum Decision {
    /// Serve these bytes + headers immediately with the given `x-ssr-cache` label.
    Serve(&'static str, Vec<(HeaderName, HeaderValue)>, Vec<u8>),
    /// Render via the inner handler and store the result (this request either
    /// won the single-flight refresh, or the key is cold/hard-expired).
    Render,
}

#[cfg(feature = "server")]
pub async fn ssr_cache(
    req: crate::axum::extract::Request,
    next: crate::axum::middleware::Next,
) -> crate::axum::response::Response {
    use crate::axum::body::{to_bytes, Body};
    use crate::axum::http::{header, HeaderValue as HV, Method, StatusCode};
    use crate::axum::response::Response;

    let cacheable = req.method() == Method::GET
        && req.uri().path().starts_with("/spaces/")
        && is_anonymous(&req);
    if !cacheable {
        return next.run(req).await;
    }

    let key = req
        .uri()
        .path_and_query()
        .map(|pq| pq.as_str().to_string())
        .unwrap_or_default();

    // Decide under a read lock. `refreshing` is an atomic so the single-flight
    // winner can be chosen without upgrading to a write lock.
    let decision = {
        let now = Instant::now();
        match cache().read() {
            Ok(store) => match store.get(&key) {
                Some(e) if now < e.soft_expires => {
                    Decision::Serve("HIT", e.headers.clone(), e.body.clone())
                }
                Some(e) if now < e.soft_expires + STALE_GRACE => {
                    // Stale but usable. Exactly one request flips `refreshing`
                    // and re-renders; everyone else keeps serving stale bytes,
                    // so expiry never triggers a render burst.
                    if e.refreshing
                        .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
                        .is_ok()
                    {
                        Decision::Render
                    } else {
                        Decision::Serve("STALE", e.headers.clone(), e.body.clone())
                    }
                }
                // Absent or hard-expired → cold render.
                _ => Decision::Render,
            },
            Err(_) => Decision::Render,
        }
    };

    match decision {
        Decision::Serve(label, headers, body) => {
            let mut builder = Response::builder().status(StatusCode::OK);
            for (name, value) in headers {
                builder = builder.header(name, value);
            }
            builder = builder.header("x-ssr-cache", label);
            if let Ok(resp) = builder.body(Body::from(body)) {
                return resp;
            }
            Response::builder()
                .status(StatusCode::INTERNAL_SERVER_ERROR)
                .body(Body::empty())
                .unwrap_or_default()
        }
        Decision::Render => {
            // Render. On failure, clear any `refreshing` flag we may have set so
            // a later stale request retries instead of getting stuck.
            let resp = next.run(req).await;
            let ok_html = resp.status() == StatusCode::OK
                && resp
                    .headers()
                    .get(header::CONTENT_TYPE)
                    .and_then(|v| v.to_str().ok())
                    .map(|ct| ct.contains("text/html"))
                    .unwrap_or(false);
            if !ok_html {
                if let Ok(store) = cache().read() {
                    if let Some(e) = store.get(&key) {
                        e.refreshing.store(false, Ordering::Release);
                    }
                }
                return resp;
            }

            let (mut parts, body) = resp.into_parts();
            let bytes = match to_bytes(body, MAX_BODY).await {
                Ok(bytes) => bytes,
                Err(_) => return Response::from_parts(parts, Body::empty()),
            };
            // Snapshot the replayable headers BEFORE we stamp our own marker, so
            // the stored entry carries the render's own headers (incl. security
            // headers like Strict-Transport-Security) and no `x-ssr-cache`.
            let headers: Vec<(HeaderName, HeaderValue)> = parts
                .headers
                .iter()
                .filter(|(name, _)| !skip_header(name))
                .map(|(name, value)| (name.clone(), value.clone()))
                .collect();

            if let Ok(mut store) = cache().write() {
                if store.len() >= MAX_ENTRIES && !store.contains_key(&key) {
                    let now = Instant::now();
                    store.retain(|_, e| now < e.soft_expires + STALE_GRACE);
                }
                store.insert(
                    key,
                    Entry {
                        soft_expires: Instant::now() + TTL,
                        refreshing: AtomicBool::new(false),
                        headers,
                        body: bytes.to_vec(),
                    },
                );
            }
            parts
                .headers
                .insert("x-ssr-cache", HV::from_static("MISS"));
            Response::from_parts(parts, Body::from(bytes))
        }
    }
}
