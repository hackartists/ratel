// Hand-written runtime for the generated handler clients (`make gen-ts`).
//
// This file is the ONLY place that knows about transport. The generated
// handler functions (one per Rust #[get]/#[post]/... handler) build the URL
// and forward the body/query objects here. The surface matches biyard/asset's
// ts-bridges runtime (apiGet/apiPost/..., setBaseUrl, setHeaderProvider,
// ApiError) so handlers and hooks follow the same conventions.
//
// Wire contract — the Dioxus server functions, unchanged
// (docs/superpower/2026-09-14-react-frontend-migration.md §4.1). Differences
// from asset:
//   - Body (POST/PUT/PATCH, and DELETE when the handler takes one): an object
//     keyed by the Rust argument name, e.g. `{ req }` — the generated handler
//     builds it. Body-less POST/PUT/PATCH send `{}`.
//   - Path and query values are serialized like Rust `to_url_value`: strings
//     as-is, everything else as JSON.
//   - Failure: handler errors are `{ message, code, data }` with `data`
//     externally tagged (`{"Auth":"UserNotFound"}`); extractor rejections
//     (no session, …) are text/plain. `ApiError.server` / `ApiError.is()`.
//   - Tauri: requests go through the native `api_request` command, because
//     iOS WKWebView drops the cross-site session cookie from in-WebView
//     fetches (same path as app/ratel/src/common/fullstack/tauri_web/server_fn.rs).
//   - Success (2xx): plain JSON of the return value; empty body → `undefined`.
//   - Auth: same-origin cookies via `credentials: "include"`.

/** Base URL prepended to every request path. Empty = same origin. */
let BASE_URL = "";

/** Override the API base URL. Required in the Tauri build (the WebView origin isn't the API). */
export function setBaseUrl(url: string): void {
  BASE_URL = url.replace(/\/+$/, "");
}

/** Optional header injector for browser requests. The native Tauri command sends no custom headers. */
let HEADER_PROVIDER: (() => Record<string, string>) | null = null;

export function setHeaderProvider(fn: (() => Record<string, string>) | null): void {
  HEADER_PROVIDER = fn;
}

/** Serialized `common::Error` body of a failed handler. */
export interface ServerError {
  message: string;
  code?: number;
  data?: unknown;
}

/** Thrown on any non-2xx response. `status` is 0 when the request never reached the server. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`HTTP ${status}: ${body}`);
    this.name = "ApiError";
  }

  /** The handler error, or `null` for text/plain extractor rejections and non-JSON bodies. */
  get server(): ServerError | null {
    try {
      const parsed = JSON.parse(this.body) as unknown;
      if (isRecord(parsed) && typeof parsed.message === "string") return parsed as unknown as ServerError;
    } catch {
      // Not JSON: an extractor rejection or a gateway page, not a handler error.
    }
    return null;
  }

  /**
   * Matches the serialized `common::Error` variant: `is("UnauthorizedAccess")`
   * for a unit variant, `is("Auth", "UserNotFound")` for a nested one.
   */
  is(variant: string, inner?: string): boolean {
    const data = this.server?.data;
    if (inner === undefined) return data === variant || (isRecord(data) && variant in data);
    return isRecord(data) && data[variant] === inner;
  }
}

/** A path segment value, serialized and percent-encoded (Rust `to_url_value` + `urlencoding::encode`). */
export function pathValue(value: unknown): string {
  return encodeURIComponent(toUrlValue(value));
}

function toUrlValue(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

/** Serialize a query object to a `?k=v` string (skips null/undefined). */
function toQuery(query?: Record<string, unknown>): string {
  if (!query) return "";
  const parts: string[] = [];
  for (const [k, v] of Object.entries(query)) {
    if (v !== null && v !== undefined) parts.push(`${k}=${encodeURIComponent(toUrlValue(v))}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

async function request<T>(
  method: Method,
  path: string,
  body?: unknown,
  query?: Record<string, unknown>,
): Promise<T> {
  const url = `${BASE_URL}${path}${toQuery(query)}`;
  const payload = body !== undefined ? JSON.stringify(body) : undefined;

  const { status, text } = isTauri()
    ? await sendNative(method, url, payload)
    : await sendFetch(method, url, payload);

  if (status < 200 || status >= 300) throw new ApiError(status, text);
  if (text.length === 0) return undefined as T;
  return JSON.parse(text) as T;
}

export function apiGet<T>(path: string, query?: Record<string, unknown>): Promise<T> {
  return request<T>("GET", path, undefined, query);
}

export function apiDelete<T>(path: string, query?: Record<string, unknown>, body?: unknown): Promise<T> {
  return request<T>("DELETE", path, body, query);
}

export function apiPost<T>(path: string, body: unknown = {}, query?: Record<string, unknown>): Promise<T> {
  return request<T>("POST", path, body, query);
}

export function apiPut<T>(path: string, body: unknown = {}, query?: Record<string, unknown>): Promise<T> {
  return request<T>("PUT", path, body, query);
}

export function apiPatch<T>(path: string, body: unknown = {}, query?: Record<string, unknown>): Promise<T> {
  return request<T>("PATCH", path, body, query);
}

interface TauriInternals {
  invoke<R>(cmd: string, args?: Record<string, unknown>): Promise<R>;
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: TauriInternals;
  }
}

export function isTauri(): boolean {
  return typeof window !== "undefined" && typeof window.__TAURI_INTERNALS__?.invoke === "function";
}

async function sendFetch(method: Method, url: string, payload: string | undefined) {
  const headers: Record<string, string> = {};
  if (HEADER_PROVIDER) Object.assign(headers, HEADER_PROVIDER());
  if (payload !== undefined) headers["Content-Type"] = "application/json";
  try {
    const res = await fetch(url, { method, credentials: "include", headers, body: payload });
    return { status: res.status, text: await res.text().catch(() => "") };
  } catch (err) {
    return { status: 0, text: String(err) };
  }
}

/** `ratel_tauri_lib::commands::api_request::ApiResponse`; transport failures come back as status 0. */
interface NativeResponse {
  status: number;
  body: string;
}

async function sendNative(method: Method, url: string, payload: string | undefined) {
  if (!/^https?:\/\//.test(url)) {
    return { status: 0, text: "setBaseUrl() must be called with the API origin in the Tauri build" };
  }
  try {
    const res = await window.__TAURI_INTERNALS__!.invoke<NativeResponse>("api_request", {
      method,
      url,
      body: payload ?? null,
    });
    return { status: res.status, text: res.body };
  } catch (err) {
    return { status: 0, text: String(err) };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
