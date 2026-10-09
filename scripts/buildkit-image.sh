#!/bin/bash
set -euo pipefail

# Build a Dockerfile with the in-cluster buildkitd and push the image to the
# in-cluster registry — the runner-pod replacement for the docker-CLI
# `make docker` path (that target remains for the local/ECR route). Adapted
# from asset's scripts/buildkit-image.sh; ratel difference: historically the
# image's build CONTEXT was not the repo root but a prebuilt output directory
# produced by an earlier native-cargo-build step. That is no longer true for
# the Rust images (app-shell, events): since the multi-arch migration the
# Dockerfiles cross-compile INSIDE buildkit (tonistiigi/xx + xx-cargo — see
# app/ratel/Dockerfile and deploy/dev/Dockerfile.events), so CONTEXT for
# those two is now `.` (the repo root, so the Dockerfile can COPY the whole
# cargo workspace). The web image still uses a prebuilt output dir
# (apps/web/dist + apps/web/server — no Rust, no cross-compile concern).
#
# Usage (app-shell, cross-compiled inside the Dockerfile):
#   NAME=ratel-app-shell \
#   DOCKERFILE=app/ratel/Dockerfile \
#   IMAGE_TAG=pr-<num> \
#   BUILD_ARGS="FEATURES=server,bypass,design-preview ENV=local ..." \
#   SECRETS="AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test ..." \
#     bash scripts/buildkit-image.sh
#
# Usage (PR preview web image):
#   NAME=ratel-web \
#   CONTEXT=apps/web \
#   DOCKERFILE=apps/web/Dockerfile \
#   IMAGE_TAG=pr-<num> \
#     bash scripts/buildkit-image.sh
#
# Env:
#   NAME           image repository name (required), e.g. ratel-app-shell
#   DOCKERFILE     Dockerfile path relative to the repo root (required)
#   IMAGE_TAG      image tag (required — PR previews use pr-<num>)
#   CONTEXT        build context directory (default `.` — repo root; the web
#                  image passes apps/web since it packages a prebuilt
#                  dist/server output, not the cargo workspace)
#   BUILDKIT_HOST  buildkitd address — preset in the runner pods
#                  (tcp://buildkitd.infra.svc.cluster.local:1234 or the
#                  amd64-only tcp://buildkitd-amd64.infra.svc.cluster.local:1234
#                  — multi-arch builds need the amd64 buildkitd, which
#                  cross-compiles both the amd64 AND arm64 binaries via
#                  tonistiigi/xx; there is no arm64 buildkitd capable of the
#                  reverse cross-compile for these Dockerfiles)
#   PUSH_REGISTRY  push target (default registry.infra.svc.cluster.local:5000
#                  — the in-cluster registry Service, http). Pods pull the
#                  SAME name: the k3s nodes' registries.yaml maps it to the
#                  Service IP endpoint, since node containerd cannot resolve
#                  cluster DNS itself.
#   BUILD_ARGS     optional, space-separated KEY=VALUE pairs forwarded as
#                  --opt build-arg. For NON-SECRET compile-time env only
#                  (ENV, DOMAIN, FEATURES, DYNAMO_TABLE_PREFIX, ...) — these
#                  land in the image's build history in plaintext.
#   SECRETS        optional, space-separated list of SHELL VARIABLE NAMES
#                  (not KEY=VALUE pairs) whose current value should be
#                  forwarded as buildkit `--secret id=NAME,src=<tmpfile>`.
#                  Each named variable must already be set in this script's
#                  environment (the workflow's job-level `env:` block sets
#                  them from `${{ secrets.* }}`). Looking the value up via
#                  `${!name}` — instead of parsing it out of a single
#                  "NAME=value" string — is what lets a value contain
#                  whitespace or embedded newlines (e.g. ICP_IDENTITY_PEM, a
#                  multi-line PEM key) without word-splitting corrupting it;
#                  a KEY=VALUE-pairs string cannot survive that case because
#                  `for kv in ${SECRETS}` splits on every space AND newline
#                  in $IFS, fragmenting a multi-line value into bogus tokens
#                  (see git history for the dev-workflow run this broke).
#                  Each value is written to a 0600 tempfile under a private
#                  tempdir (never passed as a CLI arg or build-arg, so it
#                  never lands in process listings, the image's build
#                  history, or its layers) and the Dockerfile reads it with
#                  `RUN --mount=type=secret,id=NAME ...`. The tempdir is
#                  removed on exit whether the build succeeds or fails.
#   PLATFORM       default linux/amd64,linux/arm64 — both the main (arm64)
#                  and the amd64 node are schedulable, so every image is
#                  built for both and buildkit assembles a multi-arch
#                  manifest list. The Pi node (light/arm64) stays excluded by
#                  k8s nodeAffinity/node-class, not by image platform — qdrant
#                  (jemalloc) aborts on its 16K page-size kernel and that
#                  problem has nothing to do with the image's CPU arch.

NAME="${NAME:?NAME is required (image repository name)}"
DOCKERFILE="${DOCKERFILE:?DOCKERFILE is required}"
IMAGE_TAG="${IMAGE_TAG:?IMAGE_TAG is required}"
CONTEXT="${CONTEXT:-.}"
PUSH_REGISTRY="${PUSH_REGISTRY:-registry.infra.svc.cluster.local:5000}"
PLATFORM="${PLATFORM:-linux/amd64,linux/arm64}"
: "${BUILDKIT_HOST:?BUILDKIT_HOST is not set — run inside a runner pod or export it}"

test -d "${CONTEXT}" || {
  echo "::error::build context '${CONTEXT}' does not exist — did the preceding build step run?"
  exit 1
}
test -f "${DOCKERFILE}" || {
  echo "::error::Dockerfile '${DOCKERFILE}' does not exist"
  exit 1
}

image="${PUSH_REGISTRY}/${NAME}:${IMAGE_TAG}"
echo "building ${image} (${PLATFORM}, context=${CONTEXT}, buildkitd=${BUILDKIT_HOST})"

# BUILD_ARGS: space-separated KEY=VALUE pairs, each forwarded as a
# --opt build-arg. Values themselves may not contain spaces. NON-SECRET only.
build_arg_opts=()
for kv in ${BUILD_ARGS:-}; do
  build_arg_opts+=(--opt "build-arg:${kv}")
done

# SECRETS: space-separated list of variable NAMES (see the header comment
# above for why this is names-to-look-up rather than inline KEY=VALUE
# pairs — the latter breaks on any value containing whitespace/newlines,
# e.g. a PEM key). Each named variable's CURRENT value is written to its own
# file under a 0700 tempdir (never embedded in a buildctl CLI arg) and
# forwarded as --secret id=NAME,src=<path>; the Dockerfile mounts it with
# `RUN --mount=type=secret,id=NAME,target=/run/secrets/NAME` and reads the
# file inside the RUN step, so the value never touches a build-arg, an image
# layer, or the image's build history.
secret_opts=()
secrets_dir=""
cleanup() {
  [ -n "${secrets_dir}" ] && rm -rf "${secrets_dir}"
  return 0
}
trap cleanup EXIT
if [ -n "${SECRETS:-}" ]; then
  secrets_dir="$(mktemp -d)"
  chmod 700 "${secrets_dir}"
  for key in ${SECRETS}; do
    path="${secrets_dir}/${key}"
    umask 077
    printf '%s' "${!key:-}" > "${path}"
    secret_opts+=(--secret "id=${key},src=${path}")
  done
fi

buildctl build \
  --frontend dockerfile.v0 \
  --local context="${CONTEXT}" \
  --local dockerfile="$(dirname "${DOCKERFILE}")" \
  --opt "filename=$(basename "${DOCKERFILE}")" \
  --opt "platform=${PLATFORM}" \
  "${build_arg_opts[@]}" \
  "${secret_opts[@]}" \
  --output "type=image,name=${image},push=true,registry.insecure=true"

echo "pushed ${image}"
