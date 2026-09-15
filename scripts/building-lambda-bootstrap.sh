#! /bin/bash

# Inside docker run -it -v $(HOME)/.cargo/bin:/root/.cargo/bin -v $(pwd):/app -w /app public.ecr.aws/sam/build-provided.al2023
source app/ratel/env.sh

# install platform
dnf install -y openssl-devel pkgconf-pkg-config gcc

# install cargo
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y

source ~/.cargo/env

rustup toolchain install stable

cd app/ratel

# app-shell is API-only after the React frontend migration (see
# docs/superpower/2026-09-14-react-frontend-migration.md § 5.1): the binary
# no longer serves a Dioxus wasm client, so this Lambda build no longer needs
# dx/dioxus-cli, a wasm32-unknown-unknown target, or node/npm (those only
# existed here to produce the wasm bundle app/ratel/build.rs used to embed).
# A plain release build of the server+lambda feature set is enough.
cargo build --release --no-default-features --features server,lambda

cd ../..

chown -R $HOST_UID:$HOST_GID target
chown -R $HOST_UID:$HOST_GID /root/.cargo
