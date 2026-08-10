//! In-process SSR response cache for anonymous space-viewer page GETs.
//!
//! `GET /spaces/**` server-renders a *viewer-independent* shell for anonymous
//! visitors: the 13 space cards (poll/quiz/discussion/apps/…) load client-side
//! after hydration, and the SSR HTML was verified to carry no per-user data and
//! no `Set-Cookie`. Under load every anonymous hit re-renders that identical
//! shell, so throughput is capped by how fast the app pods can render — the
//! measured ~1k rps ceiling on 2 pods.
//!
//! This layer memoizes the rendered `200 text/html` response per request path
//! for a short TTL and replays it from memory, turning "render on every hit"
//! into "render once per TTL, copy for everyone". It is the cheap way to lift
//! read throughput (e.g. a JMeter space-page test to 4k rps) without adding
//! pods or a CDN/ingress cache.
//!
//! ## Safety (why this can't leak sessions or serve the wrong shell)
//! - Caches ONLY `GET`, ONLY paths under `/spaces/`, and ONLY when NO session
//!   cookie is present. The session cookie is `{env}_sid` (see
//!   `session_layer`), so any `…_sid=` in the Cookie header marks a logged-in
//!   request that ALWAYS bypasses — the anonymous cache can never store or serve
//!   a logged-in (per-user) shell, and vice-versa.
//! - Stores ONLY `200 text/html` bodies. Non-200, non-HTML, and every `/api/**`
//!   or streaming response flow straight through untouched (never buffered).
//! - The layer sits OUTSIDE the session layer, so a cache HIT skips session
//!   lookup entirely; it emits `x-ssr-cache: HIT|MISS` for verification.

#[cfg(feature = "server")]
use std::collections::HashMap;
#[cfg(feature = "server")]
use std::sync::{OnceLock, RwLock};
#[cfg(feature = "server")]
use std::time::{Duration, Instant};

/// How long a rendered anonymous shell stays servable from memory.
#[cfg(feature = "server")]
const TTL: Duration = Duration::from_secs(10);
/// Soft cap on distinct cached paths; on overflow we sweep expired entries.
#[cfg(feature = "server")]
const MAX_ENTRIES: usize = 2_000;
/// Upper bound when buffering a cacheable body (SSR shells are ~20–60 KiB).
#[cfg(feature = "server")]
const MAX_BODY: usize = 4 * 1024 * 1024;

#[cfg(feature = "server")]
struct Entry {
    expires: Instant,
    content_type: Option<String>,
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

#[cfg(feature = "server")]
pub async fn ssr_cache(
    req: crate::axum::extract::Request,
    next: crate::axum::middleware::Next,
) -> crate::axum::response::Response {
    use crate::axum::body::{to_bytes, Body};
    use crate::axum::http::{header, HeaderValue, Method, StatusCode};
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

    // Fast path: fresh hit → replay bytes, skipping render AND session lookup.
    if let Ok(store) = cache().read() {
        if let Some(entry) = store.get(&key) {
            if entry.expires > Instant::now() {
                let mut builder = Response::builder()
                    .status(StatusCode::OK)
                    .header("x-ssr-cache", "HIT");
                if let Some(ct) = &entry.content_type {
                    builder = builder.header(header::CONTENT_TYPE, ct);
                }
                if let Ok(resp) = builder.body(Body::from(entry.body.clone())) {
                    return resp;
                }
            }
        }
    }

    // Miss → render, then memoize only a 200 text/html response.
    let resp = next.run(req).await;
    if resp.status() != StatusCode::OK {
        return resp;
    }
    let content_type = resp
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(str::to_owned);
    let is_html = content_type
        .as_deref()
        .map(|ct| ct.contains("text/html"))
        .unwrap_or(false);
    if !is_html {
        return resp;
    }

    let (mut parts, body) = resp.into_parts();
    let bytes = match to_bytes(body, MAX_BODY).await {
        Ok(bytes) => bytes,
        // Oversized/stream error on an already-rendered SSR shell is not
        // expected; fall back to an untouched (empty-bodied) response rather
        // than caching a partial. Not reachable for normal HTML.
        Err(_) => return Response::from_parts(parts, Body::empty()),
    };

    if let Ok(mut store) = cache().write() {
        if store.len() >= MAX_ENTRIES {
            let now = Instant::now();
            store.retain(|_, e| e.expires > now);
        }
        store.insert(
            key,
            Entry {
                expires: Instant::now() + TTL,
                content_type,
                body: bytes.to_vec(),
            },
        );
    }

    parts
        .headers
        .insert("x-ssr-cache", HeaderValue::from_static("MISS"));
    Response::from_parts(parts, Body::from(bytes))
}
