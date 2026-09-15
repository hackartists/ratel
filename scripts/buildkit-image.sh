#!/bin/bash
set -euo pipefail

# Build a Dockerfile with the in-cluster buildkitd and push the image to the
# in-cluster registry — the runner-pod replacement for the docker-CLI
# `make docker` path (that target remains for the local/ECR route). Adapted
# from asset's scripts/buildkit-image.sh; ratel difference: the image's
# build CONTEXT is not the repo root but a prebuilt output directory produced
# by an earlier step (the app-shell binary directory for the API server, or
# the React `dist`/`server` output for the web image), so the context is
# parameterized.
#
# Usage (PR preview app-shell image):
#   NAME=ratel-app-shell \
#   CONTEXT=target/server-image \
#   DOCKERFILE=app/ratel/Dockerfile \
#   IMAGE_TAG=pr-<num> \
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
#   CONTEXT        build context directory (default `.` — repo root). The
#                  ratel images package a prebuilt output, so callers pass
#                  target/server-image (app-shell) or apps/web (web) — see
#                  the usage examples above.
#   BUILDKIT_HOST  buildkitd address — preset in the runner pods
#                  (tcp://buildkitd.infra.svc.cluster.local:1234)
#   PUSH_REGISTRY  push target (default registry.infra.svc.cluster.local:5000
#                  — the in-cluster registry Service, http). Pods pull the
#                  SAME name: the k3s nodes' registries.yaml maps it to the
#                  Service IP endpoint, since node containerd cannot resolve
#                  cluster DNS itself.
#   BUILD_ARGS     optional, space-separated KEY=VALUE pairs forwarded as
#                  --opt build-arg (the icp image pins its two source
#                  branches this way)
#   PLATFORM       default linux/arm64 (both cluster nodes are arm64; the
#                  runner's native cargo build already produced arm64
#                  binaries, so no cross-compile happens here — this is just
#                  the image manifest platform).

NAME="${NAME:?NAME is required (image repository name)}"
DOCKERFILE="${DOCKERFILE:?DOCKERFILE is required}"
IMAGE_TAG="${IMAGE_TAG:?IMAGE_TAG is required}"
CONTEXT="${CONTEXT:-.}"
PUSH_REGISTRY="${PUSH_REGISTRY:-registry.infra.svc.cluster.local:5000}"
PLATFORM="${PLATFORM:-linux/arm64}"
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

# Note: unlike asset's script there is no ENV / APP_FEATURES build-arg —
# ratel's app Dockerfile (app/ratel/Dockerfile) declares no ARGs; every
# compile-time knob was already baked by the native `make build-testing`
# that produced the context directory.
# BUILD_ARGS: space-separated KEY=VALUE pairs, each forwarded as a
# --opt build-arg. Values themselves may not contain spaces.
build_arg_opts=()
for kv in ${BUILD_ARGS:-}; do
  build_arg_opts+=(--opt "build-arg:${kv}")
done

buildctl build \
  --frontend dockerfile.v0 \
  --local context="${CONTEXT}" \
  --local dockerfile="$(dirname "${DOCKERFILE}")" \
  --opt "filename=$(basename "${DOCKERFILE}")" \
  --opt "platform=${PLATFORM}" \
  "${build_arg_opts[@]}" \
  --output "type=image,name=${image},push=true,registry.insecure=true"

echo "pushed ${image}"
