#!/usr/bin/env bash
# One-command local Ratel stack (Docker only). See docs/local-docker.md.
#
#   scripts/local-stack.sh up      build + start everything, wait until ready
#   scripts/local-stack.sh down    stop and remove the containers
#   scripts/local-stack.sh logs    follow API + web logs (or: logs <service>…)
#   scripts/local-stack.sh status  show container state
#   scripts/local-stack.sh reset   down + wipe local DynamoDB data, then up
#
# Services (docker-compose profile `local`):
#   local-web            http://localhost:4173  React app (proxies API paths)
#   local-api            http://localhost:8080  Rust API server (bypass + design-preview)
#   postgres             localhost:55432        ratel/ratel, seeded test users
#   localstack           localhost:4566         DynamoDB/S3 (reset on every up)
#   qdrant               localhost:6333/6334
#   dynamodb-admin is optional: docker compose --profile local --profile infra up -d dynamodb-admin
set -euo pipefail

cd "$(dirname "$0")/.."
COMPOSE=(docker compose --profile local)

WEB_URL="http://localhost:4173"
API_URL="http://localhost:8080"

require_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "Docker is required: https://docs.docker.com/get-docker/" >&2
    exit 1
  fi
  if ! docker info >/dev/null 2>&1; then
    echo "Docker daemon is not running (start Docker Desktop first)." >&2
    exit 1
  fi
}

# Stop early when a port the stack publishes is already taken — by a host
# process (a locally started cargo/node server) or by a container that is not
# part of this compose project (e.g. another checkout's stack).
check_ports() {
  local busy=()
  local own
  own=$("${COMPOSE[@]}" ps -q 2>/dev/null | cut -c1-12 | tr '\n' ' ')
  for port in 4173 8080 55432 4566 6333 6334; do
    local containers
    containers=$(docker ps --filter "publish=$port" --format '{{.ID}} {{.Names}}' 2>/dev/null || true)
    if [ -n "$containers" ]; then
      while read -r id name; do
        [ -z "$id" ] && continue
        case " $own " in *" ${id:0:12} "*) ;; *) busy+=("$port(container $name)") ;; esac
      done <<< "$containers"
      continue
    fi
    if command -v lsof >/dev/null 2>&1; then
      local owners
      # lsof exits 1 when nothing listens; don't let set -e/pipefail treat that as a failure.
      owners=$( (lsof -nP -iTCP:"$port" -sTCP:LISTEN -Fc 2>/dev/null || true) | sed -n 's/^c//p' | sort -u | tr '\n' ' ')
      if [ -n "$owners" ] && ! echo "$owners" | grep -qiE 'docker|com\.docke|vpnkit'; then
        busy+=("$port($owners)")
      fi
    fi
  done
  if [ "${#busy[@]}" -gt 0 ]; then
    echo "These ports are already in use: ${busy[*]}" >&2
    echo "Stop those processes/containers (docker stop <name>) and run again." >&2
    exit 1
  fi
}

wait_for() {
  local name=$1 url=$2 timeout=$3
  local deadline=$(( $(date +%s) + timeout ))
  printf 'Waiting for %s (%s) ' "$name" "$url"
  until curl -fsS -o /dev/null "$url" 2>/dev/null; do
    if [ "$(date +%s)" -ge "$deadline" ]; then
      echo " timed out."
      echo "Check the logs: scripts/local-stack.sh logs" >&2
      exit 1
    fi
    printf '.'
    sleep 3
  done
  echo " ready"
}

up() {
  require_docker
  check_ports
  echo "Building images and starting the stack (first build takes a while)..."
  "${COMPOSE[@]}" up -d --build --remove-orphans
  wait_for "API" "$API_URL/api/auth/me" 600
  wait_for "web" "$WEB_URL/healthz" 300
  cat <<EOF

Ratel is running.
  Web app          $WEB_URL
  API              $API_URL
  Postgres         postgres://ratel:ratel@localhost:55432/ratel

Test login: hi+user1@biyard.co (verification code 000000)
Logs:       scripts/local-stack.sh logs
Stop:       scripts/local-stack.sh down
EOF
}

case "${1:-up}" in
  up) up ;;
  down) require_docker; "${COMPOSE[@]}" down --remove-orphans ;;
  logs)
    require_docker
    shift || true
    if [ "$#" -eq 0 ]; then set -- local-api local-web; fi
    "${COMPOSE[@]}" logs -f --tail=200 "$@"
    ;;
  status) require_docker; "${COMPOSE[@]}" ps ;;
  reset)
    require_docker
    "${COMPOSE[@]}" down --remove-orphans
    rm -rf .build/localstack-data
    up
    ;;
  *)
    echo "usage: $0 {up|down|logs [service...]|status|reset}" >&2
    exit 2
    ;;
esac
