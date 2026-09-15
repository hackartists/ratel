#!/usr/bin/env bash
# Registers this Apple Silicon Mac as a temporary GitHub Actions runner for
# .github/workflows/mobile-release-local.yml (store releases without
# GitHub-hosted minutes), and removes it again.
#
#   scripts/mobile-release-runner.sh up       # register + start the runners
#   scripts/mobile-release-runner.sh status   # what GitHub and this Mac see
#   scripts/mobile-release-runner.sh down     # stop, unregister, delete them
#
# Env:
#   RUNNER_REPO    owner/repo to register on          (default: biyard/ratel)
#   RUNNER_COUNT   runners `up` starts; 2 lets Android and iOS build at once
#                                                     (default: 2)
#   RUNNER_ROOT    folder holding the runners         (default: ~/.ratel-release-runners)
#   FORCE=1        let `down` stop a runner that is in the middle of a job
#
# Runners are registered on the repository only — never the organization —
# with the single label `ratel-mac` and no default labels, so the jobs that
# ask for `self-hosted` (every other ratel workflow, served by the org's Linux
# runners) never land on this Mac. `down` only touches the runners named in
# RUNNER_ROOT. Needs `gh` signed in as a repository admin.
set -euo pipefail

REPO="${RUNNER_REPO:-biyard/ratel}"
COUNT="${RUNNER_COUNT:-2}"
ROOT="${RUNNER_ROOT:-$HOME/.ratel-release-runners}"
LABEL="ratel-mac"
NAME_PREFIX="$(hostname -s)-ratel-release"

log() { printf '\033[1;36m==>\033[0m %s\n' "$*" >&2; }
die() { printf '\033[1;31merror:\033[0m %s\n' "$*" >&2; exit 1; }

usage() {
  sed -n '2,21p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

require() {
  command -v gh >/dev/null || die "gh (GitHub CLI) is required"
  gh auth status >/dev/null 2>&1 || die "gh is not signed in (gh auth login)"
  [ "$(uname -s)-$(uname -m)" = "Darwin-arm64" ] || die "this script registers an Apple Silicon Mac"
}

runner_name() {
  sed -n 's/.*"agentName"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$1/.runner" 2>/dev/null | head -1
}

# GitHub's view of one repository runner by name: "<id> <busy>", or nothing.
remote_runner() {
  gh api "repos/$REPO/actions/runners?per_page=100" \
    --jq ".runners[] | select(.name == \"$1\") | \"\(.id) \(.busy)\""
}

# Latest actions/runner release for macOS arm64, downloaded once and checked
# against the SHA-256 published in the release notes. Prints the tarball path.
runner_tarball() {
  local tag version tarball sha
  tag="$(gh api repos/actions/runner/releases/latest --jq .tag_name)"
  version="${tag#v}"
  tarball="$ROOT/actions-runner-osx-arm64-$version.tar.gz"
  if [ ! -f "$tarball" ]; then
    sha="$(gh api repos/actions/runner/releases/latest \
      --jq '.body | capture("<!-- BEGIN SHA osx-arm64 -->(?<sha>[0-9a-f]+)<!-- END SHA osx-arm64 -->").sha')"
    [ -n "$sha" ] || die "no SHA-256 for osx-arm64 in the $tag release notes"
    log "downloading actions runner $version"
    curl -fsSL -o "$tarball.part" \
      "https://github.com/actions/runner/releases/download/$tag/actions-runner-osx-arm64-$version.tar.gz"
    if [ "$(shasum -a 256 "$tarball.part" | awk '{print $1}')" != "$sha" ]; then
      rm -f "$tarball.part"
      die "runner tarball checksum mismatch"
    fi
    mv "$tarball.part" "$tarball"
  fi
  printf '%s\n' "$tarball"
}

cmd_up() {
  require
  mkdir -p "$ROOT"
  local tarball dir name token pid i
  tarball="$(runner_tarball)"
  # The release jobs call Homebrew (xcodegen) and cargo (rustup, cargo-tauri);
  # the runner keeps the PATH it was configured and started with.
  export PATH="/opt/homebrew/bin:$HOME/.cargo/bin:$PATH"

  for i in $(seq 1 "$COUNT"); do
    dir="$ROOT/runner-$i"
    name="$NAME_PREFIX-$i"
    if [ ! -f "$dir/.runner" ]; then
      rm -rf "$dir"
      mkdir -p "$dir"
      tar -xzf "$tarball" -C "$dir"
      token="$(gh api -X POST "repos/$REPO/actions/runners/registration-token" --jq .token)"
      log "registering $name on $REPO (label: $LABEL)"
      (cd "$dir" && ./config.sh --unattended --url "https://github.com/$REPO" --token "$token" \
        --name "$name" --labels "$LABEL" --no-default-labels --work _work --replace >/dev/null)
    fi
    if [ -f "$dir/runner.pid" ] && kill -0 "$(cat "$dir/runner.pid")" 2>/dev/null; then
      log "$name is already running"
      continue
    fi
    (
      cd "$dir"
      nohup ./run.sh >runner.log 2>&1 &
      echo $! >runner.pid
    )
    pid="$(cat "$dir/runner.pid")"
    # Keep the Mac from idle-sleeping for as long as this runner is up.
    nohup caffeinate -i -s -w "$pid" >/dev/null 2>&1 &
    log "$name started (log: $dir/runner.log)"
  done

  log "trigger a release: gh workflow run mobile-release-local.yml --repo $REPO -f platform=both -f confirm=RELEASE"
  log "remove the runners afterwards: $0 down"
}

cmd_down() {
  require
  local dir name remote id busy token found=0
  for dir in "$ROOT"/runner-*; do
    [ -d "$dir" ] || continue
    found=1
    name="$(runner_name "$dir")"
    remote=""
    if [ -n "$name" ]; then remote="$(remote_runner "$name")"; fi
    id="${remote%% *}"
    busy="${remote##* }"
    if [ "$busy" = "true" ] && [ "${FORCE:-}" != "1" ]; then
      die "$name is running a job; wait for it or rerun with FORCE=1"
    fi

    if [ -f "$dir/runner.pid" ]; then kill "$(cat "$dir/runner.pid")" 2>/dev/null || true; fi
    pkill -f "$dir/bin/Runner." 2>/dev/null || true

    if [ -f "$dir/.runner" ]; then
      token="$(gh api -X POST "repos/$REPO/actions/runners/remove-token" --jq .token)"
      (cd "$dir" && ./config.sh remove --token "$token" >/dev/null 2>&1) || true
    fi
    # Still registered (config.sh remove failed or the folder was incomplete):
    # delete it through the API, by the id of this runner's own name.
    if [ -n "$name" ]; then
      remote="$(remote_runner "$name")"
      id="${remote%% *}"
      if [ -n "$id" ]; then gh api -X DELETE "repos/$REPO/actions/runners/$id" >/dev/null; fi
    fi

    rm -rf "$dir"
    log "removed ${name:-$(basename "$dir")}"
  done
  [ "$found" = 1 ] || log "no runners in $ROOT"
  rm -f "$ROOT"/actions-runner-osx-arm64-*.tar.gz
  rmdir "$ROOT" 2>/dev/null || true
}

cmd_status() {
  require
  log "runners registered on $REPO"
  gh api "repos/$REPO/actions/runners?per_page=100" \
    --jq '.runners[] | "  \(.name)  \(.status)  busy=\(.busy)  [\([.labels[].name] | join(","))]"'
  local dir name state
  for dir in "$ROOT"/runner-*; do
    [ -d "$dir" ] || continue
    name="$(runner_name "$dir")"
    state="stopped"
    if [ -f "$dir/runner.pid" ] && kill -0 "$(cat "$dir/runner.pid")" 2>/dev/null; then state="running"; fi
    log "local ${name:-$(basename "$dir")}: $state"
  done
}

case "${1:-}" in
  up) cmd_up ;;
  down) cmd_down ;;
  status) cmd_status ;;
  -h | --help | help) usage 0 ;;
  *) usage 1 ;;
esac
