use crate::common::*;

pub fn run() {
    let cfg = crate::common::CommonConfig::default();

    crate::common::logger::init(cfg.log_level.into()).expect("logger failed to init");

    debug!("Logger initialized with level {:?}", cfg.log_level);

    // The tauri-web build does NOT use dioxus-fullstack — our
    // `by_macros::server_fn` proc-macro emits reqwest-based stubs that
    // read the backend base URL from `MOBILE_API_URL` at compile time
    // (see `common::fullstack::tauri_web::server_fn::base_url`). So
    // there's no global server URL to set here.

    #[cfg(feature = "server")]
    serve();
}

/// Axum router with every `#[get]`/`#[post]`/… server function registered.
/// The UI is served by the React build (apps/web), so there is no page
/// renderer or static-asset fallback here.
#[cfg(feature = "server")]
pub fn api_router() -> axum::Router {
    use dioxus::server::{DioxusRouterExt, FullstackState};
    axum::Router::<FullstackState>::new()
        .register_server_functions()
        .with_state(FullstackState::headless())
}

#[cfg(feature = "server")]
fn install_panic_hook() {
    use std::sync::Once;
    static INIT: Once = Once::new();
    INIT.call_once(|| {
        let prev = std::panic::take_hook();
        std::panic::set_hook(Box::new(move |info| {
            let payload = info
                .payload()
                .downcast_ref::<&str>()
                .copied()
                .or_else(|| info.payload().downcast_ref::<String>().map(|s| s.as_str()))
                .unwrap_or("<non-string panic payload>");
            let location = info
                .location()
                .map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column()))
                .unwrap_or_else(|| "<unknown location>".to_string());
            tracing::error!(panic = %payload, location = %location, "server thread panicked");
            // Delegate to the previous hook so backtraces still print when
            // RUST_BACKTRACE=1 and tests still observe the panic normally.
            prev(info);
        }));
    });
}

#[cfg(feature = "server")]
fn serve() {
    install_panic_hook();

    let cfg = crate::common::CommonConfig::default();

    let cli = cfg.dynamodb();

    // Run pending migrations. No-op unless `MIGRATE=true` is set in the env.
    // Blocks server startup until done; set on exactly one instance per
    // release. The conditional UpdateItem in `LastBackfillVersion::advance_to`
    // is the safety net for accidental double-set.
    if let Ok(handle) = tokio::runtime::Handle::try_current() {
        if let Err(e) = handle.block_on(crate::common::migrations::run_migrations(cli)) {
            tracing::error!(error = %e, "migration runner failed; aborting startup");
            std::process::exit(1);
        }
    } else {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("tokio runtime build for migrations");
        if let Err(e) = rt.block_on(crate::common::migrations::run_migrations(cli)) {
            tracing::error!(error = %e, "migration runner failed; aborting startup");
            std::process::exit(1);
        }
    }

    // Wire the Postgres pool: register it as the process-global pool and run
    // schema migrations from the PostgresEntity inventory before serving. The
    // session store (and future migrated slices) resolve the global pool.
    {
        let pool = cfg.postgres().clone();
        ::postgres::set_global_pool(pool.clone());

        // Resolve a runtime once (reused across retries).
        enum MigRt {
            Current(tokio::runtime::Handle),
            Owned(tokio::runtime::Runtime),
        }
        let rt = match tokio::runtime::Handle::try_current() {
            Ok(h) => MigRt::Current(h),
            Err(_) => MigRt::Owned(
                tokio::runtime::Builder::new_current_thread()
                    .enable_all()
                    .build()
                    .expect("tokio runtime build for postgres migrations"),
            ),
        };

        // Retry transient migration failures in-process instead of exiting.
        // A hard exit here restarts the container, and every aborted boot leaks
        // its pooled connections (a killed process's sockets linger on the
        // server); enough of those and Postgres hits `max_connections`, which
        // then makes EVERY subsequent boot's migration time out — a
        // self-inflicted crash loop. Retrying rides out Postgres still coming up
        // or a momentary connection blip without ever entering that loop.
        let mut attempt = 0u32;
        const MAX_ATTEMPTS: u32 = 20;
        loop {
            attempt += 1;
            let migrate =
                async { ::postgres::Schema::from_inventory().migrate(&pool).await };
            let res = match &rt {
                MigRt::Current(h) => h.block_on(migrate),
                MigRt::Owned(r) => r.block_on(migrate),
            };
            match res {
                Ok(()) => break,
                Err(e) if attempt < MAX_ATTEMPTS => {
                    tracing::warn!(
                        error = %e,
                        attempt,
                        "postgres schema migration failed; retrying in 3s"
                    );
                    std::thread::sleep(std::time::Duration::from_secs(3));
                }
                Err(e) => {
                    tracing::error!(
                        error = %e,
                        attempt,
                        "postgres schema migration failed after retries; aborting startup"
                    );
                    std::process::exit(1);
                }
            }
        }
    }

    let session_layer =
        crate::common::middlewares::session_layer::get_session_layer(cfg.env.to_string());

    // Allow cross-origin requests from the Tauri Android/iOS WebView
    // (http://tauri.localhost / https://tauri.localhost) and from the
    // production frontend (https://ratel.foundation and its subdomains).
    // Web traffic is same-origin so it never triggers CORS — these entries
    // exist only for the Tauri shell and any subdomain frontends.
    //
    // CORS layer is placed OUTSIDE the session layer so preflight OPTIONS
    // requests never hit session lookup (they carry no credentials).
    let cors_layer = {
        use tower_http::cors::{AllowOrigin, CorsLayer};
        let allow = AllowOrigin::predicate(|origin, _req_parts| {
            let bytes = origin.as_bytes();
            // Android Tauri WebView serves the app from http(s)://tauri.localhost;
            // iOS WKWebView uses the custom scheme origin `tauri://localhost`.
            // With `allow_credentials(true)` the exact origin must be echoed, so
            // the iOS scheme has to be listed explicitly (a wildcard is invalid).
            bytes == b"http://tauri.localhost"
                || bytes == b"https://tauri.localhost"
                || bytes == b"tauri://localhost"
                || bytes == b"https://ratel.foundation"
                || (bytes.starts_with(b"https://") && bytes.ends_with(b".ratel.foundation"))
        });
        CorsLayer::new()
            .allow_origin(allow)
            .allow_credentials(true)
            .allow_methods([
                axum::http::Method::GET,
                axum::http::Method::POST,
                axum::http::Method::PUT,
                axum::http::Method::PATCH,
                axum::http::Method::DELETE,
                axum::http::Method::OPTIONS,
            ])
            .allow_headers([
                axum::http::header::CONTENT_TYPE,
                axum::http::header::AUTHORIZATION,
                axum::http::header::ACCEPT,
                axum::http::header::COOKIE,
            ])
    };

    let mcp_router = crate::common::mcp::mcp_router();
    let membership_router = crate::features::membership::server::router();
    let arcade_router = crate::features::arcade::server::router();
    let cross_posting_router = crate::features::cross_posting::server::router();
    let launchpad_partner_router = crate::features::launchpad_partner::server::router();
    let dioxus_router = api_router()
        .merge(mcp_router)
        .merge(membership_router)
        .merge(arcade_router)
        .merge(cross_posting_router)
        .merge(launchpad_partner_router);
    // CatchPanicLayer turns any panic in the request future into a 500 response
    // instead of letting it propagate up the spawn_pinned worker thread, which
    // would terminate the worker (and drop the connection). Pairs with the
    // panic hook below so we still capture the backtrace in logs.
    //
    // log_request is the OUTERMOST layer so its post-handler log sees the
    // final response (status, latency) including anything cors / session
    // appended.
    let app = dioxus_router
        .layer(tower_http::catch_panic::CatchPanicLayer::new())
        .layer(cors_layer)
        .layer(session_layer)
        // Compress text responses here rather than at the proxy.
        //
        // dev sits behind the shared ingress-nginx, whose ConfigMap is empty,
        // so `use-gzip` keeps its upstream default of false and the 17 KB SSR
        // shell goes out uncompressed. It cannot be fixed from this repo: there
        // is no gzip Ingress annotation, and `configuration-snippet` has been
        // refused by default since controller 1.9. Setting it in that ConfigMap
        // would also turn compression on for every other service sharing the
        // controller. prod fronts the app with CloudFront, which does compress
        // at the edge — but the origin fetch behind it still carries the full
        // body, and the plan is to move prod onto k3s, where there is no edge
        // left to fall back on. Compressing here covers all three cases and
        // travels with the deploy rather than with cluster state.
        //
        // gzip only. `compression-br` was tried and dropped: on this page it
        // produced the same size (3479 vs 3500 bytes) for 2.5x the CPU (+24%
        // per request against +9%), and since browsers send `gzip, deflate, br,
        // zstd` with no q-values, tower-http breaks the tie by enum order — so
        // brotli would have been the path nearly every real request took.
        .layer(tower_http::compression::CompressionLayer::new())
        .layer(axum::middleware::from_fn(log_request));

    crate::common::mcp::set_app_router(app.clone());

    // Register arcade realtime channel handlers with the per-process
    // global hub. Each game registers its own channels here so the
    // SSE endpoint can resolve them by kind. Idempotent — re-registers
    // overwrite, which is what tests rely on for mock channels.
    // `serve` is synchronous (called before tokio main spawns the
    // server), so we block on the registration through whichever
    // runtime is available.
    if let Ok(handle) = tokio::runtime::Handle::try_current() {
        handle.block_on(
            crate::features::arcade::games::fact_or_fold::realtime::register_channels(),
        );
    } else {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("tokio runtime build for channel registration");
        rt.block_on(crate::features::arcade::games::fact_or_fold::realtime::register_channels());
    }

    #[cfg(not(feature = "lambda"))]
    {
        // Postgres migration (Phase 5): the Postgres outbox poller replaces the
        // DynamoDB Stream as the event source for the CDC dispatcher. It runs on
        // every server deployment (single-processing across replicas via a
        // pg_advisory_lock) — unlike the local-dev-only DynamoDB stream poller
        // below, which is now inert (no stream on Postgres).
        #[cfg(feature = "server")]
        {
            tracing::info!("Starting Postgres outbox poller (CDC dispatcher source)");
            crate::common::events::outbox::spawn_outbox_poller();
        }

        #[cfg(feature = "design-preview")]
        let app = {
            let manifest_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
            let design_dir = manifest_dir.join("assets/design");
            let app = crate::common::design_preview::merge_design_routes(app, &design_dir);

            // Repo root is app/ratel/../.. — mount the roadmap/ spec folder as /roadmap.
            let roadmap_dir = manifest_dir.join("../../roadmap");
            if roadmap_dir.exists() {
                crate::common::design_preview::merge_roadmap_routes(app, &roadmap_dir)
            } else {
                app
            }
        };

        dioxus::serve(move || {
            let app = app.clone();

            async move { Ok(app) }
        });
    }

    #[cfg(feature = "lambda")]
    {
        use lambda_http::tower::ServiceExt;
        use lambda_http::Service;
        use lambda_runtime::LambdaEvent;

        let app_future = async move {
            lambda_runtime::run(lambda_runtime::service_fn(
                move |event: LambdaEvent<serde_json::Value>| {
                    let app = app.clone();
                    async move {
                        let (payload, ctx) = event.into_parts();

                        if payload.get("source").is_some()
                            && payload.get("detail-type").is_some()
                            && payload.get("detail").is_some()
                        {
                            let eb_event: EventBridgeEnvelope = serde_json::from_value(payload)
                                .map_err(lambda_runtime::Error::from)?;
                            eb_event.proc().await?;
                            Ok::<serde_json::Value, lambda_runtime::Error>(
                                serde_json::json!({"statusCode": 200}),
                            )
                        } else {
                            let lambda_request: lambda_http::request::LambdaRequest =
                                serde_json::from_value(payload)
                                    .map_err(lambda_runtime::Error::from)?;
                            let mut adapter = lambda_http::Adapter::from(app);
                            let svc = adapter.ready().await.map_err(lambda_runtime::Error::from)?;

                            let resp = svc
                                .call(LambdaEvent::new(lambda_request, ctx))
                                .await
                                .map_err(lambda_runtime::Error::from)?;
                            serde_json::to_value(resp).map_err(lambda_runtime::Error::from)
                        }
                    }
                },
            ))
            .await
        };

        info!("Starting server in Lambda environment");
        if let Ok(handle) = tokio::runtime::Handle::try_current() {
            let _ = handle.block_on(app_future);
        } else {
            let _ = tokio::runtime::Builder::new_multi_thread()
                .enable_all()
                .build()
                .unwrap()
                .block_on(app_future);
        }
    }
}

/// Axum middleware that logs every incoming request as a single line:
/// method, URI, status, latency and selected headers. The request body is
/// never read or logged, so payloads stream to the handler untouched and
/// sensitive content stays out of logs. Authorization / Cookie are reported
/// as flags only.
#[cfg(feature = "server")]
async fn log_request(
    req: axum::extract::Request,
    next: axum::middleware::Next,
) -> axum::response::Response {
    let method = req.method().clone();
    let uri = req.uri().clone();
    let headers = req.headers();

    let origin = headers
        .get(axum::http::header::ORIGIN)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("-")
        .to_string();
    let user_agent = headers
        .get(axum::http::header::USER_AGENT)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("-")
        .to_string();
    let content_type = headers
        .get(axum::http::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("-")
        .to_string();
    let content_length = headers
        .get(axum::http::header::CONTENT_LENGTH)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("-")
        .to_string();
    let has_auth = headers.contains_key(axum::http::header::AUTHORIZATION);
    let has_cookie = headers.contains_key(axum::http::header::COOKIE);

    let start = std::time::Instant::now();
    let response = next.run(req).await;
    let elapsed = start.elapsed();

    tracing::info!(
        target: "http",
        "{method} {uri} -> {status} {elapsed:.2?} origin={origin} ua={user_agent} ct={content_type} cl={content_length} auth={auth} cookie={cookie}",
        method = method,
        uri = uri,
        status = response.status().as_u16(),
        elapsed = elapsed,
        origin = origin,
        user_agent = user_agent,
        content_type = content_type,
        content_length = content_length,
        auth = if has_auth { "yes" } else { "no" },
        cookie = if has_cookie { "yes" } else { "no" },
    );

    response
}
