#!/usr/bin/env bash
# Print a 12-hex content hash of everything that goes into a CI artifact, so
# CI can skip work whose inputs already produced an image (or a passing
# check). Ported from biyard/dataroom scripts/image-input-hash.sh.
#
# Usage: image-input-hash.sh app-shell|events|web|rust-check
#
# Rust targets hash the app/ratel path-dependency closure (followed through
# every Cargo.toml `path = "..."`, including the root [workspace.dependencies])
# rather than the whole repo, so web/docs/playwright-only changes keep the
# same hash. Build config that is not a file — BUILD_ARGS, SECRETS values,
# PLATFORM, VITE_* — is read from the environment and hashed too.
set -euo pipefail
shopt -s inherit_errexit 2>/dev/null || true

cd "$(git rev-parse --show-toplevel)" >/dev/null

target="${1:?usage: image-input-hash.sh app-shell|events|web|rust-check}"

PLATFORM="${PLATFORM:-linux/amd64,linux/arm64}"

sha256() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum; else shasum -a 256; fi
}

# Committed content only (tree/blob ids from HEAD) — the checkout is clean
# in CI, and HEAD ids are cheap to read for whole directories.
emit_file() {
  local h
  h=$(git rev-parse --verify -q "HEAD:$1" 2>/dev/null) \
    || h=$(git hash-object -- "$1" 2>/dev/null) \
    || { echo "error: input file '$1' not found" >&2; exit 1; }
  echo "file $1 $h"
}

emit_dir() {
  local h
  h=$(git rev-parse --verify -q "HEAD:$1") \
    || { echo "error: '$1' is not a directory in HEAD" >&2; exit 1; }
  echo "dir $1 $h"
}

# Crate dirs reachable from $1 through Cargo.toml path dependencies. The repo
# root is seeded so `workspace = true` deps resolve via [workspace.dependencies].
closure() {
  local root tmp next
  root="$(pwd -P)"
  tmp="$(mktemp)"
  printf '%s\n.\n' "$1" > "$tmp"
  while :; do
    next=$(
      {
        cat "$tmp"
        while IFS= read -r d; do
          [ -f "$d/Cargo.toml" ] || continue
          { grep -oE 'path[[:space:]]*=[[:space:]]*"[^"]+"' "$d/Cargo.toml" || true; } \
            | sed -E 's/.*"([^"]+)".*/\1/' \
            | while IFS= read -r p; do
                abs=$(cd "$d/$p" >/dev/null 2>&1 && pwd -P) || continue
                [ -f "$abs/Cargo.toml" ] || continue
                printf '%s\n' "${abs#"$root"/}"
              done
        done < "$tmp"
      } | sort -u
    )
    if [ "$next" = "$(cat "$tmp")" ]; then break; fi
    printf '%s\n' "$next" > "$tmp"
  done
  grep -v '^\.$' "$tmp"
  rm -f "$tmp"
}

rust_inputs() {
  closure app/ratel | while IFS= read -r d; do
    emit_dir "$d"
  done
  for f in Cargo.toml Cargo.lock scripts/image-input-hash.sh; do
    emit_file "$f"
  done
}

# Values only matter for change detection, so hash them instead of echoing.
secrets_digest() {
  local name
  for name in ${SECRETS:-}; do
    printf '%s=%s\n' "$name" "${!name:-}"
  done | sha256 | cut -c1-16
}

image_env() {
  echo "env BUILD_ARGS=$(echo ${BUILD_ARGS:-}) PLATFORM=${PLATFORM} SECRETS=$(secrets_digest)"
}

case "$target" in
  app-shell)
    inputs=$(
      echo "target=app-shell"
      rust_inputs
      emit_dir roadmap # COPY'd into the runtime stage for design-preview
      for f in app/ratel/Dockerfile .dockerignore scripts/buildkit-image.sh; do
        emit_file "$f"
      done
      image_env
    )
    ;;
  events)
    inputs=$(
      echo "target=events"
      rust_inputs
      for f in deploy/dev/Dockerfile.events .dockerignore scripts/buildkit-image.sh; do
        emit_file "$f"
      done
      image_env
    )
    ;;
  web)
    inputs=$(
      echo "target=web"
      emit_dir apps/web
      emit_dir packages/ts-bridges
      for f in package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc \
               scripts/buildkit-image.sh scripts/image-input-hash.sh; do
        emit_file "$f"
      done
      env | grep -E '^VITE_' | sort || true
      image_env
    )
    ;;
  rust-check)
    # The job definition itself is an input (toolchain, flags, check list).
    inputs=$(
      echo "target=rust-check"
      rust_inputs
      emit_dir packages/ts-bridges
      for f in .github/workflows/pr-workflow.yml scripts/ci-rust-cache.sh; do
        emit_file "$f"
      done
    )
    ;;
  *)
    echo "error: unknown target '$target'" >&2
    exit 1
    ;;
esac

if [ -n "${HASH_DEBUG:-}" ]; then
  printf '%s\n' "$inputs" >&2
fi
printf '%s\n' "$inputs" | sha256 | cut -c1-12
