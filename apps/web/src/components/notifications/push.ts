// app/ratel/src/features/notifications/hooks/use_push.rs (+ web/push_register.js,
// web/push_deeplink.js): register the native FCM token once signed in, and
// route notification taps into the router.
//
// Native contract (unchanged — app/ratel-tauri/src-tauri/gen/android/.../MainActivity.kt):
//   - token: `window.__RATEL_FCM__ = {token, deviceId, platform}`, then a
//     `ratel-fcm-ready` event;
//   - tap: `window.__RATEL_PENDING_URL__ = url` (cold start) and a
//     `ratel-deeplink` CustomEvent whose `detail` is the url (live tap).
// Kotlin re-injects both a few times after the WebView is created; the
// device upsert is idempotent.
//
// Rust compiles the real hook only for `tauri-web` (Android and iOS) and a
// no-op everywhere else. The React bundle is shared, so the same split is a
// runtime check on the Tauri bridge: on the plain web build nothing happens.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isTauri } from "@ratel/ts-bridges";
import { useRegisterDevice } from "@ratel/ts-bridges/hooks";
import { useAuth } from "@/lib/auth";
import { deepLinkPath } from "./deep-link";

/** Rust `FcmInfo` (serde `deviceId` rename). */
interface FcmInfo {
  token: string;
  deviceId: string;
  platform: string;
}

const pushWindow = () =>
  window as unknown as {
    __RATEL_FCM__?: unknown;
    __RATEL_PENDING_URL__?: unknown;
  };

/** What `runner.recv::<FcmInfo>()` accepts; anything else is dropped like a failed recv. */
function parseFcmInfo(value: unknown): FcmInfo | null {
  if (typeof value !== "object" || value === null) return null;
  const { token, deviceId, platform } = value as Record<string, unknown>;
  if (typeof token !== "string" || typeof deviceId !== "string" || typeof platform !== "string") return null;
  return { token, deviceId, platform };
}

export function usePush(): void {
  const { loggedIn } = useAuth();
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  const { mutate: registerDevice } = useRegisterDevice();
  const [fcm, setFcm] = useState<FcmInfo | null>(null);

  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  // push_register.js: take the injected token now, or once on `ratel-fcm-ready`.
  useEffect(() => {
    if (!isTauri()) return;
    const w = pushWindow();
    const grab = () => {
      const info = parseFcmInfo(w.__RATEL_FCM__);
      if (info) setFcm(info);
    };
    if (w.__RATEL_FCM__) {
      grab();
      return;
    }
    window.addEventListener("ratel-fcm-ready", grab, { once: true });
    return () => window.removeEventListener("ratel-fcm-ready", grab);
  }, []);

  // Register whenever there is a token AND a signed-in user, so it runs right
  // after a login too. Rust only logs a failure.
  useEffect(() => {
    if (!fcm || !loggedIn) return;
    registerDevice(
      { device_id: fcm.deviceId, token: fcm.token, platform: fcm.platform },
      { onError: (e) => console.error(`push: register_device failed: ${e.message}`) },
    );
  }, [fcm, loggedIn, registerDevice]);

  // push_deeplink.js: forward the cold-start url once, then every live tap.
  useEffect(() => {
    if (!isTauri()) return;
    const w = pushWindow();
    const open = (url: unknown) => {
      if (typeof url === "string" && url !== "") navigateRef.current(deepLinkPath(url));
    };
    if (w.__RATEL_PENDING_URL__) {
      const url = w.__RATEL_PENDING_URL__;
      w.__RATEL_PENDING_URL__ = null;
      open(url);
    }
    const onDeepLink = (event: Event) => open((event as CustomEvent<unknown>).detail);
    window.addEventListener("ratel-deeplink", onDeepLink);
    return () => window.removeEventListener("ratel-deeplink", onDeepLink);
  }, []);
}
