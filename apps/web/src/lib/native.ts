// The native Tauri commands (app/ratel-tauri/src-tauri/src/commands, registered
// in lib.rs `generate_handler!`) as typed async functions. Every call into
// `window.__TAURI_INTERNALS__` goes through this module.
//
// Argument keys are camelCase: Tauri maps them to the Rust snake_case
// parameters (`contentType` → `content_type`, `bodyB64` → `body_b64`).
//
// Branch on `isTauri()` at runtime, like Rust `native_file::is_native_shell()`;
// the browser build keeps its own path (`fetch` PUT, `<a download>`,
// `window.print()`, `window.open`).
import { isTauri } from "@ratel/ts-bridges/runtime";

export { isTauri };

interface TauriInternals {
  invoke<R>(cmd: string, args?: Record<string, unknown>): Promise<R>;
}

/** Rejects when the page is not running inside the native shell. */
function invoke<R>(cmd: string, args?: Record<string, unknown>): Promise<R> {
  const internals = (window as unknown as { __TAURI_INTERNALS__?: TauriInternals }).__TAURI_INTERNALS__;
  if (typeof internals?.invoke !== "function") {
    return Promise.reject(new Error(`Tauri bridge unavailable: ${cmd}`));
  }
  return internals.invoke<R>(cmd, args);
}

/** Base64 for binary bodies: raw bytes do not cross the invoke bridge. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// ── HTTP (api_request.rs / s3_upload.rs) ──

/** Rust `ApiResponse`; transport failures come back as `status: 0` with the error in `body`. */
export interface NativeHttpResponse {
  status: number;
  body: string;
}

/**
 * `s3_put_object`: PUT to a presigned S3 URL from the app process, which avoids
 * the WebView's cross-origin preflight (web.rs `s3_put_object_native`).
 */
export function s3PutObject(url: string, contentType: string, bodyB64: string): Promise<NativeHttpResponse> {
  return invoke<NativeHttpResponse>("s3_put_object", { url, contentType, bodyB64 });
}

// ── Files (native_file.rs) ──

/** Rust `NativeFileResponse`: `ok` only when the platform actually took the file. */
interface NativeFileResponse {
  ok: boolean;
  error: string;
}

async function delivered(what: string, response: Promise<NativeFileResponse>): Promise<void> {
  const r = await response;
  if (r.ok) return;
  // Rust `into_result`: log the native reason, give the caller a plain error.
  console.error(`${what} failed natively: ${r.error}`);
  throw new Error(`${what} failed`);
}

/** `save_file`: Downloads on Android ≥ 29, a share sheet on older Android and iOS. */
export function saveFile(fileName: string, mimeType: string, bytes: Uint8Array): Promise<void> {
  return delivered(
    "save_file",
    invoke<NativeFileResponse>("save_file", { fileName, mimeType, bodyB64: bytesToBase64(bytes) }),
  );
}

/** `print_page`: the current page as a PDF named `jobName`, handed to the user. */
export function printPage(jobName: string): Promise<void> {
  return delivered("print_page", invoke<NativeFileResponse>("print_page", { jobName }));
}

// ── Auth (google_sign_in.rs) ──

/** tauri-plugin-google-auth `TokenResponse` (the fields the app reads). */
export interface GoogleTokenResponse {
  access_token: string;
  id_token?: string | null;
}

/** `google_sign_in`: the native Google flow; returns tokens but no email. */
export function googleSignInNative(): Promise<GoogleTokenResponse> {
  return invoke<GoogleTokenResponse>("google_sign_in");
}

// ── Links (external_url.rs, tauri-plugin-opener) ──

/**
 * `open_external_url`: an http(s) URL in the default browser instead of the
 * WebView. The command's parameter is `req: ExternalUrlRequest`, so the URL is
 * nested under `req` (packages/tauri-common `open` passes a bare `{ url }`).
 */
export async function openExternalUrl(url: string): Promise<void> {
  await invoke<{ opened: boolean }>("open_external_url", { req: { url } });
}

/** `plugin:opener|open_url`: any scheme the opener scope allows (e.g. `mailto:`). */
export async function openUrl(url: string): Promise<void> {
  await invoke<void>("plugin:opener|open_url", { url });
}
