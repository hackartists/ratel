// app/ratel/src/features/auth/interop (wallet_connect.rs, google_auth.rs) and
// services (device_id.rs, restore_session.rs) as plain async functions.
//
// Wallet connect and Firebase live in the global `wallet-connect.js` and
// `ratel-app-shell.js` scripts (loaded by index.html). The Rust drivers in
// interop/web/*.js call `window.walletConnect.*` and
// `window.ratel.invoke(method, args)`; these functions do the same, and — like
// the drivers' `try { … } catch { dioxus.send(null) }` — turn a JS failure
// into `null`.
import { refreshSessionHandler } from "@ratel/ts-bridges";
import { ApiError } from "@ratel/ts-bridges/runtime";
import { googleSignInNative, isTauri } from "@/lib/native";
import { initFirebase as initFirebaseSdk, preloadFirebase, signIn as firebaseSignIn } from "./firebase";
import * as wallet from "./wallet-connect";

/** Rust `WalletConnectResult`. */
export interface WalletConnectResult {
  address: string;
  chain_id: number;
}

/** Rust `interop::UserInfo`. */
export interface UserInfo {
  access_token: string;
  id_token: string;
  email: string | null;
  display_name?: string | null;
  photo_url?: string | null;
}

/**
 * A failure that happened in the browser, not on the server: Rust maps it to a
 * `common::Error` variant (`AuthError::WalletConnectFailed`,
 * `Error::OnlyWebFunction`). The modal shows that variant's text.
 */
export class LocalAuthError extends Error {
  constructor(public readonly variant: "WalletConnectFailed" | "OnlyWebFunction") {
    super(variant);
    this.name = "LocalAuthError";
  }
}

/** Rust `format!("{e}")` of a server error: the `Display` text the server sends as `message`. */
export function serverErrorText(error: unknown): string {
  if (error instanceof ApiError) return error.server?.message ?? error.body;
  if (error instanceof Error) return error.message;
  return String(error);
}

// ── Config (Rust `WalletConnectConfig::default()` / `FirebaseConfig::default()`) ──
// Rust bakes these in at compile time with `option_env!`; Vite does the same
// with `VITE_`-prefixed variables.

const WALLET_CONNECT_CONFIG = {
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? "",
  appName: "Ratel",
  appDescription: "Human Essence Platform",
  appUrl: "",
};

const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? "",
};

// ── Wallet (wc_init.js, wc_connect.js, wc_sign_message.js, wc_open_app.js) ──

/** Rust `wallet_connect_initialize(&WalletConnectConfig::default())` — fire and forget. */
export function walletInitialize(): void {
  const { projectId, appName, appDescription, appUrl } = WALLET_CONNECT_CONFIG;
  try {
    wallet.initialize(projectId, appName, appDescription, appUrl);
  } catch (e) {
    console.error("Failed to initialize WalletConnect:", e);
  }
}

/** Rust `wallet_connect()`: connect via QR, keep the session alive. */
export async function walletConnect(): Promise<WalletConnectResult> {
  try {
    const result = await wallet.connect();
    if (result) return result;
  } catch {
    // wc_connect.js sends null.
  }
  throw new LocalAuthError("WalletConnectFailed");
}

/** Rust `wallet_sign_message()`: sign with the active session. */
export async function walletSignMessage(message: string): Promise<string> {
  try {
    const signature = await wallet.signMessage(message);
    if (typeof signature === "string") return signature;
  } catch {
    // wc_sign_message.js sends null.
  }
  throw new LocalAuthError("WalletConnectFailed");
}

/** Rust `wallet_open_app()`: open the wallet for a pending sign request. */
export async function walletOpenApp(): Promise<void> {
  try {
    await wallet.openWalletApp();
  } catch {
    throw new LocalAuthError("WalletConnectFailed");
  }
}

// ── Google (google_auth.rs) ──

/** Rust `init_firebase(&FirebaseConfig::default())`; failures are only logged. */
export async function initFirebase(): Promise<void> {
  if (isTauri()) return; // The native build never initializes the Firebase JS SDK.
  try {
    await initFirebaseSdk(FIREBASE_CONFIG);
  } catch (e) {
    console.error("Failed to initialize Firebase:", e);
  }
}

/**
 * Starts downloading the Firebase SDK so a later Google click can open its
 * popup without waiting (a popup opened after a network wait gets blocked).
 */
export function warmUpGoogleSignIn(): void {
  if (isTauri()) return;
  preloadFirebase().catch((e) => console.error("Failed to load Firebase:", e));
}

/** Starts downloading the WalletConnect SDK so the first wallet click does not wait for it. */
export function warmUpWalletConnect(): void {
  wallet.preloadWalletConnect().catch((e) => console.error("Failed to load WalletConnect:", e));
}

/**
 * Rust `sign_in()`. Web: Firebase `signInWithPopup` (`./firebase`). Tauri: the
 * native `google_sign_in` command (tauri-plugin-google-auth), which returns
 * Google's tokens but no email.
 */
export async function googleSignIn(): Promise<UserInfo> {
  if (isTauri()) {
    try {
      const token = await googleSignInNative();
      return { access_token: token.access_token, id_token: token.id_token ?? "", email: null };
    } catch (e) {
      console.error("google_sign_in threw", e);
      throw new LocalAuthError("OnlyWebFunction");
    }
  }
  let result: unknown = null;
  try {
    result = await firebaseSignIn();
  } catch (e) {
    console.error("signIn threw", e);
  }
  if (result && typeof result === "object" && typeof (result as UserInfo).access_token === "string") {
    return result as UserInfo;
  }
  // A failed popup resolves `undefined` → the Rust `recv` failed with OnlyWebFunction.
  throw new LocalAuthError("OnlyWebFunction");
}

// ── Device id + refresh token (services/device_id.rs, restore_session.rs) ──

const DEVICE_ID_STORAGE_KEY = "device_id";
const REFRESH_TOKEN_STORAGE_KEY = "refresh_token";

/** UUIDv7 (timestamp-prefixed), like Rust `uuid::Uuid::now_v7()`. */
function uuidV7(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const ts = Date.now().toString(16).padStart(12, "0");
  for (let i = 0; i < 6; i++) bytes[i] = parseInt(ts.slice(i * 2, i * 2 + 2), 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Rust `device_id::get_or_create()`: the persistent per-install id (`null` without storage). */
export function getOrCreateDeviceId(): string | null {
  try {
    const existing = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing && existing.trim()) return existing;
    const id = uuidV7();
    window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
    return id;
  } catch {
    return null;
  }
}

/**
 * Rust `login_device_id()`: only the native mobile shell sends a device id (the
 * browser's cookie jar already survives restarts).
 */
export function loginDeviceId(): string | null {
  return isTauri() ? getOrCreateDeviceId() : null;
}

/** Rust `restore_session::clear_refresh_token()`. */
export function clearRefreshToken(): void {
  try {
    window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  } catch {
    // storage blocked
  }
}

/** Rust `remember_refresh_token()`. */
export function rememberRefreshToken(token: string | null | undefined): void {
  if (!token) return;
  try {
    window.localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, token);
  } catch {
    // Storage unavailable: nothing to restore next launch, like Rust.
  }
}

/**
 * Rust `restore_session::try_restore_session()`: exchange the cached refresh
 * token for a fresh server session. Best effort, never throws. Success rotates
 * the saved token; a rejected token is cleared so later launches stop retrying.
 * No cached token or no device id: nothing to do (the user was signed out).
 */
export async function tryRestoreSession(): Promise<void> {
  let refreshToken: string | null;
  try {
    refreshToken = window.localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
  } catch {
    return;
  }
  if (!refreshToken) return;
  const deviceId = getOrCreateDeviceId();
  if (!deviceId) return;

  try {
    const resp = await refreshSessionHandler({ refresh_token: refreshToken, device_id: deviceId });
    window.localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, resp.refresh_token);
  } catch (e) {
    console.error(`refresh failed, clearing cached token: ${serverErrorText(e)}`);
    try {
      window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    } catch {
      // Storage unavailable.
    }
  }
}
