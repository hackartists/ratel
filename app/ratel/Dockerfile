# syntax=docker/dockerfile:1.7
#
# app-shell — the ratel Dioxus fullstack API server. Multi-arch
# (linux/amd64 + linux/arm64) via cross-compilation INSIDE this Dockerfile,
# following the biyard/dataroom pattern (services/dataroom/Dockerfile):
# tonistiigi/xx + xx-cargo let ONE amd64 buildkitd produce both the amd64
# AND the arm64 binary from a single invocation (buildctl --opt
# platform=linux/amd64,linux/arm64) — no native arm64 build host is needed
# anymore, which is what let CI move off the arm64-only runner pool.
#
# This replaces the former "runner compiles natively (arm64-only), Dockerfile
# just COPYs the binary" split (COPY . . below used to copy the pre-built
# target/server-image/server). Every compile-time secret that used to arrive
# as job env (option_env!-baked AWS_*, FIREBASE_*, PORTONE_*, KAIA_*,
# BBS_BLS_*, P256_*, LAUNCHPAD_*, QDRANT_*, DYNAMO_TABLE_PREFIX, ... — see
# app/ratel/Cargo.toml / build.rs for the full option_env! list) now has to
# cross the buildkit boundary explicitly:
#   - non-secret values (ENV, DOMAIN, FEATURES, DYNAMO_TABLE_PREFIX, ...) are
#     ordinary ARGs — fine to appear in build history.
#   - anything sensitive (AWS keys, API secrets, PEMs, AEAD keys) is passed
#     with buildctl `--secret id=KEY,src=<file>` (scripts/buildkit-image.sh
#     SECRETS=...) and read here via `RUN --mount=type=secret,id=KEY` so it
#     never lands in an image layer or `docker history`.
#
# Build context is the repository root (CONTEXT=. in scripts/buildkit-image.sh)
# — unlike the old prebuilt-binary recipe, the Dockerfile now needs the whole
# cargo workspace to run `cargo build` itself.

FROM --platform=$BUILDPLATFORM tonistiigi/xx:1.9.0 AS xx

FROM --platform=$BUILDPLATFORM rust:1-bookworm AS builder
COPY --from=xx / /
RUN apt-get update && apt-get install -y --no-install-recommends \
      clang lld cmake pkg-config \
    && rm -rf /var/lib/apt/lists/*
ARG TARGETPLATFORM
# gcc/g++/libc6-dev: xx-cargo's cross linker driver.
# zlib1g-dev: rdkafka's `cmake-build` feature links librdkafka dynamically
# against zlib (see deploy/dev/Dockerfile.events's base-image comment — the
# only non-glibc dynamic dep the resulting binaries carry).
RUN xx-apt-get update && xx-apt-get install -y --no-install-recommends \
      gcc g++ libc6-dev zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
# ratel pins no rust-toolchain.toml (unlike dataroom) — the rust:1-bookworm
# base image's preinstalled stable toolchain is what pr-workflow.yml's
# rust-check job also uses (`toolchain: stable`), so just register the
# cross target against it.
RUN xx-cargo --setup-target-triple
COPY . .

# ── Non-secret compile-time config (plain ARGs — fine in build history) ──
ARG ENV=prod
ARG DOMAIN=ratel.foundation
ARG BUCKET_NAME=metadata.ratel.foundation
ARG DYNAMO_TABLE_PREFIX=ratel-prod
ARG DYNAMODB_ENDPOINT=none
ARG AWS_REGION=ap-northeast-2
ARG KAIA_ENDPOINT=https://public-en.node.kaia.io
ARG KAIA_ARCHIVE_ENDPOINT=https://archive-en.node.kaia.io
ARG BLOCK_EXPLORER_URL=https://kairos.kaiascan.io
ARG IC_URL=https://icp0.io
ARG RATEL_CANISTER_ID=
ARG QDRANT_URL=http://qdrant.infra.svc.cluster.local:6334
ARG QDRANT_PREFIX=ratel-prod
ARG LAUNCHPAD_POINT_SYMBOL=RT
ARG WALLETCONNECT_PROJECT_ID=
ARG DISABLE_ANSI=true
ARG RUST_LOG=error
# Feature set: dev/prod build plain `server` (no bypass/design-preview);
# PR previews build `server,bypass,design-preview` (verification code
# 000000 accepted + /designs,/roadmap served — see
# deploy/pr-preview/40-ingress.yaml).
ARG FEATURES=server

ENV CARGO_TARGET_DIR=/app/target

# ── Secrets (buildctl --secret — never land in a layer or build history) ──
# Mounted at /run/secrets/<NAME>; read into env vars for the single `cargo
# build` RUN below and gone once that layer finishes. Every id is always
# mounted (scripts/buildkit-image.sh writes an empty file for an unset
# secret) so this list stays static regardless of which secrets the caller
# actually has — `option_env!` will see "" exactly like before.
RUN --mount=type=secret,id=AWS_ACCESS_KEY_ID \
    --mount=type=secret,id=AWS_SECRET_ACCESS_KEY \
    --mount=type=secret,id=ACCOUNT_ID \
    --mount=type=secret,id=PORTONE_STORE_ID \
    --mount=type=secret,id=PORTONE_INICIS_CHANNEL_KEY \
    --mount=type=secret,id=PORTONE_KPN_CHANNEL_KEY \
    --mount=type=secret,id=PORTONE_API_SECRET \
    --mount=type=secret,id=FIREBASE_API_KEY \
    --mount=type=secret,id=FIREBASE_AUTH_DOMAIN \
    --mount=type=secret,id=FIREBASE_PROJECT_ID \
    --mount=type=secret,id=FIREBASE_STORAGE_BUCKET \
    --mount=type=secret,id=FIREBASE_MESSAGING_SENDER_ID \
    --mount=type=secret,id=FIREBASE_APP_ID \
    --mount=type=secret,id=FIREBASE_MEASUREMENT_ID \
    --mount=type=secret,id=ICP_IDENTITY_PEM \
    --mount=type=secret,id=VOTER_TAG_SECRET \
    --mount=type=secret,id=ATTR_VOTING_AUTHORITY_JSON \
    --mount=type=secret,id=QDRANT_API_KEY \
    --mount=type=secret,id=LINKEDIN_CLIENT_ID \
    --mount=type=secret,id=LINKEDIN_CLIENT_SECRET \
    --mount=type=secret,id=LAUNCHPAD_BASE_URL \
    --mount=type=secret,id=LAUNCHPAD_PROJECT_ID \
    --mount=type=secret,id=LAUNCHPAD_PARTNER_SECRET \
    --mount=type=secret,id=CROSS_POSTING_DATA_KEY \
    --mount=type=secret,id=CROSS_POSTING_DATA_KEY_PREVIOUS \
    --mount=type=secret,id=TELEGRAM_TOKEN \
    --mount=type=secret,id=BBS_BLS_X \
    --mount=type=secret,id=BBS_BLS_Y \
    --mount=type=secret,id=BBS_BLS_D \
    --mount=type=secret,id=BBS_BLS_CRV \
    --mount=type=secret,id=P256_X \
    --mount=type=secret,id=P256_Y \
    --mount=type=secret,id=P256_D \
    --mount=type=secret,id=P256_CRV \
    --mount=type=cache,target=/usr/local/cargo/registry,sharing=private \
    --mount=type=cache,target=/app/target,id=cargo-target-app-shell-${TARGETPLATFORM} \
    set -eu; \
    for key in AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY ACCOUNT_ID \
      PORTONE_STORE_ID PORTONE_INICIS_CHANNEL_KEY PORTONE_KPN_CHANNEL_KEY PORTONE_API_SECRET \
      FIREBASE_API_KEY FIREBASE_AUTH_DOMAIN FIREBASE_PROJECT_ID FIREBASE_STORAGE_BUCKET \
      FIREBASE_MESSAGING_SENDER_ID FIREBASE_APP_ID FIREBASE_MEASUREMENT_ID \
      ICP_IDENTITY_PEM VOTER_TAG_SECRET ATTR_VOTING_AUTHORITY_JSON QDRANT_API_KEY \
      LINKEDIN_CLIENT_ID LINKEDIN_CLIENT_SECRET \
      LAUNCHPAD_BASE_URL LAUNCHPAD_PROJECT_ID LAUNCHPAD_PARTNER_SECRET \
      CROSS_POSTING_DATA_KEY CROSS_POSTING_DATA_KEY_PREVIOUS TELEGRAM_TOKEN \
      BBS_BLS_X BBS_BLS_Y BBS_BLS_D BBS_BLS_CRV P256_X P256_Y P256_D P256_CRV; do \
      f="/run/secrets/${key}"; \
      if [ -s "$f" ]; then export "${key}=$(cat "$f")"; fi; \
    done; \
    cd app/ratel \
    && xx-cargo build --release --no-default-features --features "${FEATURES}" --bin app-shell \
    && mkdir -p /out \
    && cp "/app/target/$(xx-cargo --print-target-triple)/release/app-shell" /out/app-shell \
    && xx-verify /out/app-shell

FROM debian:bookworm-slim

# curl is baked in so the container healthcheck is a plain `curl -f
# localhost` (see the historical note this replaces in the old Ubuntu-based
# Dockerfile: installing curl per-probe flaked under load).
RUN for i in 1 2 3; do apt-get update && break || sleep 5; done \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app
COPY --from=builder /out/app-shell ./server

# design-preview feature (PR previews / local-dev) resolves /designs and
# /roadmap against `env!("CARGO_MANIFEST_DIR")` — a value baked into the
# BINARY at compile time, i.e. an absolute path inside the builder stage
# (WORKDIR /app above, crate at app/ratel ⇒ /app/app/ratel). That path has
# to exist, verbatim, in THIS stage too, or the baked constant resolves to
# nothing at runtime — same trick deploy/local/Dockerfile.api uses (copies
# to /build/app/ratel to match its own builder WORKDIR). Dead weight when
# design-preview is off (dev/prod builds), but required for PR previews.
COPY app/ratel/assets/design /app/app/ratel/assets/design
COPY roadmap /app/roadmap

EXPOSE 8080

CMD ["./server"]
