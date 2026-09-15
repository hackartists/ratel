#!/usr/bin/env bash
# Build the Tauri mobile app (React bundle inside) and launch it on a local
# Android emulator or iOS Simulator. See docs/local-docker.md § 모바일 앱.
#
#   scripts/mobile-run.sh android     (make android)
#   scripts/mobile-run.sh ios         (make ios, macOS only)
#
# Inputs (environment):
#   MOBILE_API_ENDPOINT  API origin the app calls   (default https://dev.ratel.foundation)
#                        e.g. http://localhost:8080 for `make local`; on Android
#                        a localhost endpoint is forwarded with `adb reverse`.
#   FIREBASE_* / PORTONE_* / WALLETCONNECT_PROJECT_ID
#                        baked into the web bundle (run `ratel_envs` first);
#                        without them Google sign-in / payments do not work.
#   DEVICE               adb serial to install on    (default: first attached device)
#   AVD                  emulator to boot if none is attached (default: first AVD)
#   SIMULATOR            Simulator name or UDID      (default: booted one, else an iPhone)
#   ANDROID_HOME / ANDROID_NDK_HOME / JAVA_HOME  toolchain overrides
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TAURI_DIR="$ROOT/app/ratel-tauri"
APP_ID="co.biyard.ratel"
MOBILE_API_ENDPOINT="${MOBILE_API_ENDPOINT:-https://dev.ratel.foundation}"
MOBILE_API_ENDPOINT="${MOBILE_API_ENDPOINT%/}"

log() { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
die() { printf '\033[1;31merror:\033[0m %s\n' "$*" >&2; exit 1; }

# Non-login shells (IDE tasks, launchd) often miss the usual tool locations.
add_path() { [ -d "$1" ] && case ":$PATH:" in *":$1:"*) ;; *) PATH="$1:$PATH" ;; esac; return 0; }
add_path /opt/homebrew/bin
add_path "$HOME/.cargo/bin"
if ! command -v node >/dev/null 2>&1 && [ -d "$HOME/.nvm/versions/node" ]; then
  add_path "$(ls -d "$HOME"/.nvm/versions/node/*/bin 2>/dev/null | sort -V | tail -1)"
fi
export PATH

require() {
  for cmd in "$@"; do
    command -v "$cmd" >/dev/null 2>&1 || die "'$cmd' not found on PATH"
  done
}

warn_missing_keys() {
  if [ -z "${FIREBASE_API_KEY:-}" ]; then
    log "FIREBASE_API_KEY is empty — Google sign-in will not work (run 'ratel_envs' first)"
  fi
}

# Newest file matching NAME under DIR that is newer than STAMP.
newest_since() {
  local dir="$1" name="$2" stamp="$3"
  find "$dir" -name "$name" -newer "$stamp" -print 2>/dev/null | while read -r f; do
    printf '%s\t%s\n' "$(stat -f %m "$f" 2>/dev/null || stat -c %Y "$f")" "$f"
  done | sort -rn | head -1 | cut -f2-
}

# ── Android ──────────────────────────────────────────────────────────
android_toolchain() {
  if [ -z "${ANDROID_HOME:-}" ]; then
    for d in "$HOME/Library/Android/sdk" "$HOME/Android/Sdk" /opt/homebrew/share/android-commandlinetools /opt/android-sdk; do
      [ -d "$d" ] && ANDROID_HOME="$d" && break
    done
  fi
  [ -n "${ANDROID_HOME:-}" ] || die "Android SDK not found — set ANDROID_HOME"
  if [ -z "${ANDROID_NDK_HOME:-}" ]; then
    # NDK 27 is the version the builds were verified with; otherwise the newest.
    ANDROID_NDK_HOME="$(ls -d "$ANDROID_HOME"/ndk/27.* 2>/dev/null | sort -V | tail -1)"
    [ -n "$ANDROID_NDK_HOME" ] || ANDROID_NDK_HOME="$(ls -d "$ANDROID_HOME"/ndk/* 2>/dev/null | sort -V | tail -1)"
  fi
  [ -d "${ANDROID_NDK_HOME:-}" ] || die "Android NDK not found — install one with the SDK Manager or set ANDROID_NDK_HOME"
  if [ -z "${JAVA_HOME:-}" ] && [ -x /usr/libexec/java_home ]; then
    JAVA_HOME="$(/usr/libexec/java_home -v 17 2>/dev/null || /usr/libexec/java_home 2>/dev/null || true)"
  fi
  [ -d "${JAVA_HOME:-}" ] || die "JDK not found — install JDK 17 or set JAVA_HOME"
  export ANDROID_HOME ANDROID_NDK_HOME JAVA_HOME
  add_path "$ANDROID_HOME/platform-tools"
  add_path "$ANDROID_HOME/emulator"
  export PATH
  require adb
}

emulator_serials() { adb devices | awk 'NR>1 && $1 ~ /^emulator-/ {print $1}'; }

# Boot AVD $1 and set DEVICE to the serial of the emulator it starts.
boot_avd() {
  require emulator
  emulator -list-avds 2>/dev/null | grep -qx "$1" \
    || die "AVD '$1' not found. Available: $(emulator -list-avds 2>/dev/null | tr '\n' ' ')"
  local before
  before=" $(emulator_serials | tr '\n' ' ') "
  log "booting emulator $1"
  nohup emulator -avd "$1" >/dev/null 2>&1 &
  for _ in $(seq 1 90); do
    for s in $(emulator_serials); do
      case "$before" in *" $s "*) ;; *) DEVICE="$s"; adb -s "$DEVICE" wait-for-device; return 0 ;; esac
    done
    sleep 2
  done
  die "emulator $1 did not come up"
}

# DEVICE (serial) wins; else AVD (reuse it if already running, boot it if
# not); else the first attached device; else boot the first AVD.
android_device() {
  if [ -z "${DEVICE:-}" ] && [ -n "${AVD:-}" ]; then
    for s in $(emulator_serials); do
      if [ "$(adb -s "$s" emu avd name 2>/dev/null | head -1 | tr -d '\r')" = "$AVD" ]; then
        DEVICE="$s"
        break
      fi
    done
    [ -n "${DEVICE:-}" ] || boot_avd "$AVD"
  fi
  if [ -z "${DEVICE:-}" ]; then
    DEVICE="${ANDROID_SERIAL:-$(adb devices | awk 'NR>1 && $2=="device" {print $1; exit}')}"
  fi
  if [ -z "$DEVICE" ]; then
    require emulator
    local avd
    avd="$(emulator -list-avds 2>/dev/null | head -1)"
    [ -n "$avd" ] || die "no Android device attached and no AVD found — create one in Android Studio (Device Manager)"
    boot_avd "$avd"
  fi
  log "waiting for $DEVICE to finish booting"
  for _ in $(seq 1 120); do
    [ "$(adb -s "$DEVICE" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ] && return 0
    sleep 2
  done
  die "$DEVICE did not finish booting"
}

run_android() {
  require make cargo node corepack npm rsync python3
  android_toolchain
  warn_missing_keys
  android_device

  local abi target
  abi="$(adb -s "$DEVICE" shell getprop ro.product.cpu.abi | tr -d '\r')"
  case "$abi" in
    arm64-v8a) target=aarch64-linux-android ;;
    x86_64) target=x86_64-linux-android ;;
    *) die "unsupported device ABI '$abi'" ;;
  esac

  local stamp
  stamp="$(mktemp)"
  log "building Android debug APK ($target) → API $MOBILE_API_ENDPOINT"
  make -C "$TAURI_DIR" build-android-debug \
    MOBILE_API_URL="$MOBILE_API_ENDPOINT" ANDROID_TARGET="$target" \
    ANDROID_HOME="$ANDROID_HOME" ANDROID_NDK_HOME="$ANDROID_NDK_HOME" JAVA_HOME="$JAVA_HOME"

  local apk
  apk="$(newest_since "$TAURI_DIR/src-tauri/gen/android" '*-debug.apk' "$stamp")"
  rm -f "$stamp"
  [ -n "$apk" ] || die "build finished but no new debug APK was found"

  # A localhost endpoint means the host machine; forward it into the device.
  case "$MOBILE_API_ENDPOINT" in
    http://localhost:*|http://127.0.0.1:*)
      local port="${MOBILE_API_ENDPOINT##*:}"
      port="${port%%/*}"
      log "forwarding device localhost:$port → host localhost:$port"
      adb -s "$DEVICE" reverse "tcp:$port" "tcp:$port" >/dev/null
      ;;
  esac

  # Full reinstall: installing over an older build can leave stale WebView
  # state behind ("Something went wrong" with no logs).
  log "installing $(basename "$apk") on $DEVICE"
  adb -s "$DEVICE" uninstall "$APP_ID" >/dev/null 2>&1 || true
  adb -s "$DEVICE" install "$apk" >/dev/null
  adb -s "$DEVICE" shell am start -n "$APP_ID/.MainActivity" >/dev/null
  log "launched on $DEVICE (API $MOBILE_API_ENDPOINT)"
}

# ── iOS ──────────────────────────────────────────────────────────────
ios_simulator() {
  local udid=""
  if [ -n "${SIMULATOR:-}" ]; then
    # Exact name ("iPhone 16" must not pick "iPhone 16 Plus") or UDID; with
    # several runtimes the last listed (newest) wins.
    udid="$(xcrun simctl list devices available \
      | awk -v n="$SIMULATOR" '{ s = $0; sub(/^[ \t]+/, "", s) } index(s, n " (") == 1 || index(s, "(" n ")") > 0' \
      | grep -oE '[0-9A-F]{8}-[0-9A-F-]{27}' | tail -1 || true)"
    [ -n "$udid" ] || die "Simulator '$SIMULATOR' not found. Available: $(xcrun simctl list devices available | grep -E 'iPhone|iPad' | sed -E 's/^ +//; s/ \(.*//' | sort -u | tr '\n' ',')"
  else
    # `|| true`: grep finding nothing must fall through to the next choice, not
    # end the script silently under `set -e -o pipefail`.
    udid="$(xcrun simctl list devices booted | grep -E 'iPhone|iPad' | grep -oE '[0-9A-F]{8}-[0-9A-F-]{27}' | head -1 || true)"
    [ -n "$udid" ] || udid="$(xcrun simctl list devices available | grep 'iPhone' | grep -oE '[0-9A-F]{8}-[0-9A-F-]{27}' | tail -1 || true)"
    [ -n "$udid" ] || die "no iPhone Simulator available — add one in Xcode (Window → Devices and Simulators)"
  fi
  xcrun simctl boot "$udid" >/dev/null 2>&1 || true
  open -a Simulator --args -CurrentDeviceUDID "$udid" >/dev/null 2>&1 || true
  xcrun simctl bootstatus "$udid" -b >/dev/null
  SIM_UDID="$udid"
}

run_ios() {
  [ "$(uname -s)" = "Darwin" ] || die "iOS builds need macOS with Xcode"
  require make cargo node corepack npm rsync python3 xcrun xcodegen
  warn_missing_keys
  ios_simulator

  log "building iOS Simulator app → API $MOBILE_API_ENDPOINT"
  make -C "$TAURI_DIR" build-ios-sim MOBILE_API_URL="$MOBILE_API_ENDPOINT"

  local app
  app="$(ls -d "$TAURI_DIR"/src-tauri/gen/apple/build/arm64-sim/*.app 2>/dev/null | head -1)"
  [ -n "$app" ] || die "build finished but no .app was found under gen/apple/build/arm64-sim"

  log "installing $(basename "$app") on Simulator $SIM_UDID"
  xcrun simctl terminate "$SIM_UDID" "$APP_ID" >/dev/null 2>&1 || true
  xcrun simctl install "$SIM_UDID" "$app"
  xcrun simctl launch "$SIM_UDID" "$APP_ID" >/dev/null
  log "launched on Simulator (API $MOBILE_API_ENDPOINT)"
}

case "${1:-}" in
  android) run_android ;;
  ios) run_ios ;;
  *) echo "usage: $0 android|ios" >&2; exit 2 ;;
esac
