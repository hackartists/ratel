//! Process-wide graceful-shutdown token.
//!
//! One `CancellationToken` per process, cancelled when SIGTERM (k8s rolling
//! deploy) or SIGINT (local ctrl-c) arrives. Every long-running surface —
//! axum HTTP (`.with_graceful_shutdown(token.cancelled_owned())`), the Kafka
//! consumer loop — waits on the same token, so one signal drains the whole
//! process and `main` can return normally (never `std::process::exit`, which
//! skips `Drop` — e.g. a Kafka consumer's close/LeaveGroup).
//!
//! Ported from Assets' `packages/shared/src/shutdown.rs`; inlined here so the
//! `event` crate carries no dependency on a `shared` crate that Ratel does
//! not have.

use std::sync::OnceLock;

use tokio_util::sync::CancellationToken;

static TOKEN: OnceLock<CancellationToken> = OnceLock::new();

/// The process-wide shutdown token (a clone — `CancellationToken` clones
/// share state). The first call installs the signal listeners, so it must be
/// made from within a tokio runtime (every caller is an async `main` /
/// server task).
pub fn token() -> CancellationToken {
    TOKEN
        .get_or_init(|| {
            let token = CancellationToken::new();
            let t = token.clone();
            tokio::spawn(async move {
                let signal = wait_for_signal().await;
                tracing::info!(
                    signal,
                    "shutdown signal received; cancelling shutdown token"
                );
                t.cancel();
            });
            token
        })
        .clone()
}

/// Resolve when SIGTERM or SIGINT arrives, to the signal's name. Each arm
/// isolates its own installation failure inside its own future (a
/// `pending().await` there never blocks the other arm), so losing SIGTERM
/// still leaves SIGINT handling live and vice versa.
async fn wait_for_signal() -> &'static str {
    let sigterm_arm = async {
        #[cfg(unix)]
        {
            match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
                Ok(mut s) => {
                    s.recv().await;
                }
                Err(e) => {
                    tracing::error!(error = %e, "failed to install SIGTERM handler; relying on SIGINT only");
                    std::future::pending::<()>().await;
                }
            }
        }
        // Non-unix targets have no SIGTERM — this arm just never fires.
        #[cfg(not(unix))]
        {
            std::future::pending::<()>().await;
        }
    };
    let sigint_arm = async {
        match tokio::signal::ctrl_c().await {
            Ok(()) => {}
            Err(e) => {
                tracing::error!(error = %e, "failed to listen for SIGINT; relying on SIGTERM only");
                std::future::pending::<()>().await;
            }
        }
    };
    tokio::select! {
        _ = sigterm_arm => "SIGTERM",
        _ = sigint_arm => "SIGINT",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Clones share cancellation state, and cancelling by hand (what the
    /// signal task does) is observed by every clone.
    #[tokio::test]
    async fn token_clones_share_cancellation() {
        // Do not use the process-global `token()` here — cancelling it would
        // poison every other test in the process. Exercise the same type.
        let a = CancellationToken::new();
        let b = a.clone();
        assert!(!b.is_cancelled());
        a.cancel();
        assert!(b.is_cancelled());
        b.cancelled().await; // resolves immediately once cancelled
    }
}
