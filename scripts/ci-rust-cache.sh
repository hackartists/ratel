#!/usr/bin/env bash
# Restore/save a cargo target dir (+ cargo registry) in the in-cluster MinIO,
# and record "this input hash already passed" markers. Ported from
# biyard/dataroom scripts/ci-rust-cache.sh: actions/cache has no backend on
# these self-hosted runners worth using for multi-GB target dirs, MinIO is
# one hop away.
#
# Usage:
#   ci-rust-cache.sh restore|save <name> <target-dir> <lockfile>...
#   ci-rust-cache.sh has-pass|mark-pass <name> <input-hash>
#
# Never fails the job: every error degrades to a warning + cold build.
set -uo pipefail
shopt -s inherit_errexit 2>/dev/null || true

cd "$(git rev-parse --show-toplevel)" >/dev/null

mode="${1:?usage: ci-rust-cache.sh restore|save|has-pass|mark-pass <name> ...}"
name="${2:?missing <name>}"
shift 2

S3_ENDPOINT="${S3_ENDPOINT:-http://minio.infra.svc.cluster.local:9000}"
BUCKET="${RUST_CACHE_BUCKET:-ratel-ci-cache}"
# Not AWS_*: rust-check bakes AWS_* into the binary via option_env!.
ACCESS_KEY="${RUST_CACHE_ACCESS_KEY:-minioadmin}"
SECRET_KEY="${RUST_CACHE_SECRET_KEY:-minioadmin}"
REGION="${RUST_CACHE_REGION:-us-east-1}"
EXPIRE_DAYS="${RUST_CACHE_EXPIRE_DAYS:-7}"
MAX_MB="${RUST_CACHE_MAX_MB:-6144}"
CARGO_HOME="${CARGO_HOME:-$HOME/.cargo}"
base="/rust/${name}"
latest="${base}/latest-$(uname -m)"

warn() { echo "::warning::rust cache (${name}): $*"; }

sha256() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum; else shasum -a 256; fi
}

hmac() {
  openssl dgst -sha256 -mac HMAC -macopt "$1" | awk '{print $NF}'
}

gz() {
  if command -v pigz >/dev/null 2>&1; then pigz "$@"; else gzip "$@"; fi
}

# Minimal SigV4-signed S3 request (no aws CLI on the runner image).
s3() {
  local method="$1" path="$2"
  shift 2
  local host="${S3_ENDPOINT#*://}"
  host="${host%%/*}"
  local uri="/${BUCKET}${path%%\?*}" query="" now day scope creq sts k sig
  [ "${path}" != "${path#*\?}" ] && query="${path#*\?}="
  now="$(date -u +%Y%m%dT%H%M%SZ)"
  day="${now%%T*}"
  scope="${day}/${REGION}/s3/aws4_request"
  creq="$(printf '%s\n%s\n%s\nhost:%s\nx-amz-content-sha256:UNSIGNED-PAYLOAD\nx-amz-date:%s\n\nhost;x-amz-content-sha256;x-amz-date\nUNSIGNED-PAYLOAD' \
    "${method}" "${uri}" "${query}" "${host}" "${now}")"
  sts="$(printf 'AWS4-HMAC-SHA256\n%s\n%s\n%s' "${now}" "${scope}" "$(printf '%s' "${creq}" | sha256 | cut -d' ' -f1)")"
  k="$(printf '%s' "${day}" | hmac "key:AWS4${SECRET_KEY}")"
  k="$(printf '%s' "${REGION}" | hmac "hexkey:${k}")"
  k="$(printf 's3' | hmac "hexkey:${k}")"
  k="$(printf 'aws4_request' | hmac "hexkey:${k}")"
  sig="$(printf '%s' "${sts}" | hmac "hexkey:${k}")"
  curl -sS --retry 2 -X "${method}" \
    -H "x-amz-date: ${now}" \
    -H "x-amz-content-sha256: UNSIGNED-PAYLOAD" \
    -H "Authorization: AWS4-HMAC-SHA256 Credential=${ACCESS_KEY}/${scope}, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=${sig}" \
    "$@" "${S3_ENDPOINT%/}${uri}${query:+?${query%=}}"
}

ensure_bucket() {
  local code
  code="$(s3 PUT "" -o /dev/null -w '%{http_code}')" || code=000
  case "${code}" in
    200|409) ;;
    *) warn "could not create bucket ${BUCKET} (HTTP ${code})"; return 1 ;;
  esac

  local rule md5
  rule="<LifecycleConfiguration><Rule><ID>expire-rust-cache</ID><Status>Enabled</Status><Filter><Prefix>rust/</Prefix></Filter><Expiration><Days>${EXPIRE_DAYS}</Days></Expiration></Rule></LifecycleConfiguration>"
  md5="$(printf '%s' "${rule}" | openssl dgst -md5 -binary | openssl base64)"
  s3 PUT "?lifecycle" --fail -o /dev/null -H "Content-MD5: ${md5}" --data-binary "${rule}" \
    || warn "could not set the ${EXPIRE_DAYS}-day expiry rule on ${BUCKET}"
}

# ── pass markers ────────────────────────────────────────────────────────────
case "${mode}" in
  has-pass)
    hash="${1:?missing <input-hash>}"
    if s3 GET "${base}/pass/${hash}" --fail -o /dev/null 2>/dev/null; then
      echo "rust cache (${name}): inputs ${hash} already passed"
      exit 0
    fi
    exit 1
    ;;
  mark-pass)
    hash="${1:?missing <input-hash>}"
    ensure_bucket || exit 0
    tmp="$(mktemp)"
    printf '%s' "${GITHUB_RUN_ID:-local}" > "${tmp}"
    s3 PUT "${base}/pass/${hash}" --fail -o /dev/null -T "${tmp}" \
      && echo "rust cache (${name}): marked ${hash} as passed" \
      || warn "could not write pass marker"
    rm -f "${tmp}"
    exit 0
    ;;
esac

# ── target cache ────────────────────────────────────────────────────────────
target="${1:?missing <target-dir>}"
shift
[ "$#" -gt 0 ] || { echo "error: at least one lockfile is required" >&2; exit 2; }

# ratel pins no rust-toolchain.toml, so key on the installed rustc instead.
cache_key() {
  {
    rustc -V
    cat "$@"
    echo "arch=$(uname -m) os=$(uname -s) rustflags=${RUSTFLAGS:-}"
  } | sha256 | cut -c1-16
}

key="$(cache_key "$@")" || { warn "could not hash inputs"; exit 0; }

slot_exists() {
  s3 GET "${base}/$1/done" --fail -o /dev/null 2>/dev/null
}

restore() {
  local slot="${key}"
  if ! slot_exists "${slot}"; then
    if ! slot="$(s3 GET "${latest}" --fail 2>/dev/null)" || ! slot_exists "${slot}"; then
      echo "rust cache (${name}): no cache for ${key} and no earlier slot — cold build"
      return 0
    fi
    echo "rust cache (${name}): no slot for ${key}, falling back to latest ${slot}"
  fi

  local start=$SECONDS
  mkdir -p "${CARGO_HOME}" "${target}"
  if ! s3 GET "${base}/${slot}/cargo.tar.gz" --fail 2>/dev/null | gz -dc | tar -xf - -C "${CARGO_HOME}"; then
    warn "cargo home restore failed"
  fi
  if ! s3 GET "${base}/${slot}/target.tar.gz" --fail | gz -dc | tar -xf - -C "${target}"; then
    warn "target restore failed — discarding the partial target dir"
    rm -rf "${target}"
    return 0
  fi
  echo "rust cache (${name}): restored ${slot} in $((SECONDS - start))s"
}

save() {
  [ -d "${target}" ] || { warn "${target} does not exist — nothing to save"; return 0; }
  if slot_exists "${key}"; then
    echo "rust cache (${name}): slot ${key} already exists — skip save"
    return 0
  fi
  ensure_bucket || return 0

  local tmp start=$SECONDS mb
  tmp="$(mktemp -d)"
  trap 'rm -rf "${tmp}"' RETURN

  rm -rf "${target}"/*/incremental
  tar -cf - -C "${target}" . | gz -1 > "${tmp}/target.tar.gz" || { warn "could not archive ${target}"; return 0; }
  mb=$(( $(wc -c < "${tmp}/target.tar.gz") / 1048576 ))
  if [ "${mb}" -gt "${MAX_MB}" ]; then
    warn "target archive is ${mb} MB (> ${MAX_MB} MB) — not saving; a later cold build will start a clean slot"
    return 0
  fi

  local cargo_paths=() p
  for p in registry/index registry/cache git/db; do
    [ -d "${CARGO_HOME}/${p}" ] && cargo_paths+=("${p}")
  done
  if [ "${#cargo_paths[@]}" -gt 0 ]; then
    tar -cf - -C "${CARGO_HOME}" "${cargo_paths[@]}" | gz -1 > "${tmp}/cargo.tar.gz" \
      && s3 PUT "${base}/${key}/cargo.tar.gz" --fail -o /dev/null -T "${tmp}/cargo.tar.gz" \
      || { warn "cargo home upload failed"; return 0; }
  fi
  s3 PUT "${base}/${key}/target.tar.gz" --fail -o /dev/null -T "${tmp}/target.tar.gz" \
    || { warn "target upload failed"; return 0; }

  printf '%s' "${key}" > "${tmp}/key"
  s3 PUT "${base}/${key}/done" --fail -o /dev/null -T "${tmp}/key" \
    && s3 PUT "${latest}" --fail -o /dev/null -T "${tmp}/key" \
    || { warn "marker upload failed"; return 0; }

  echo "rust cache (${name}): saved ${key} ($(du -ch "${tmp}"/*.tar.gz | tail -1 | cut -f1)) in $((SECONDS - start))s"
}

case "${mode}" in
  restore) restore ;;
  save) save ;;
  *) echo "error: unknown mode '${mode}'" >&2; exit 2 ;;
esac
exit 0
