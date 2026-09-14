// app/ratel/src/features/social/pages/credentials/interop/mod.rs and its
// `web/*.js` drivers, translated from the Dioxus `dioxus.send`/`recv` eval
// channel to plain browser APIs — the underlying JS behavior (reading the
// PortOne redirect return, popping PG pages from history, calling into
// `window.ratel.user_credential`) is unchanged.
import { signAttributesHandler } from "@ratel/ts-bridges";
import type { CredentialResponse } from "@ratel/ts-bridges";

/** Distinguishes the two failure modes `verifyIdentity` can throw, matching
 * `common::Error::PortOneRequestFailure` / `PortOneInicisInvalidIdentity`. */
export class PortOneError extends Error {
  constructor(public code: "request_failed" | "invalid_identity") {
    super(code);
  }
}

/**
 * `interop/web/take_pg_return.js`: on a WebView/mobile PortOne redirect
 * return, reads the `identityVerificationId` PortOne appended to the URL.
 * `index.html` stashes the initial `location.search` at document-start
 * (`window.__ratelInitialSearch`) because the legacy Dioxus router used to
 * strip it on boot; React Router does not, but the same fallback keeps this
 * one-shot read working either way. Consumed (cleared) so a later visit in
 * the same session does not re-trigger finalize. Returns `null` on desktop
 * (popup flow never touches the URL) — a harmless no-op.
 */
export function takePgReturnId(): string | null {
  try {
    const w = window as unknown as { __ratelInitialSearch?: string };
    let search = w.__ratelInitialSearch;
    if (search == null) search = window.location.search || "";
    w.__ratelInitialSearch = "";
    const params = new URLSearchParams(search);
    const id = params.get("identityVerificationId");
    const txType = params.get("transactionType");
    const code = params.get("code");
    if (id && !code && (!txType || txType === "IDENTITY_VERIFICATION")) {
      return id;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * `interop/web/kyc_clear_history.js`: pops the PG pages a WebView redirect
 * stacked in history, so "back" from the returned credentials page exits to
 * the pre-credentials page instead of the verification screen. Call AFTER the
 * credential is finalized.
 */
export function clearKycHistory(): boolean {
  try {
    const key = "ratel_kyc_hist_len";
    const savedRaw = window.sessionStorage.getItem(key);
    window.sessionStorage.removeItem(key);
    const clean = window.location.origin + window.location.pathname;
    if (savedRaw != null) {
      const saved = parseInt(savedRaw, 10);
      const delta = window.history.length - saved;
      if (Number.isFinite(delta) && delta > 0) {
        window.history.replaceState(null, "", clean);
        window.history.go(-delta);
        return true;
      }
      window.history.replaceState(null, "", clean);
      return false;
    }
    window.history.replaceState(null, "", clean);
    return false;
  } catch {
    return false;
  }
}

/**
 * `interop::verify_identity`: calls into `window.ratel.user_credential`
 * (bundled into `ratel-app-shell.js`, loaded globally) to open the PortOne
 * identity-verification flow, then finalizes the resulting credential.
 */
export async function verifyIdentity(storeId: string, channelKey: string, prefix: string): Promise<CredentialResponse> {
  const ns = (window as unknown as { ratel?: { user_credential?: { request_identity_verification?: (s: string, c: string, p: string) => Promise<unknown> } } }).ratel
    ?.user_credential;
  let value: unknown;
  try {
    if (!ns?.request_identity_verification) {
      throw new Error("PortOne SDK not loaded");
    }
    value = await ns.request_identity_verification(storeId, channelKey, prefix);
  } catch {
    throw new PortOneError("request_failed");
  }
  if (typeof value !== "string") {
    throw new PortOneError("invalid_identity");
  }
  return signAttributesHandler({ type: "port_one", id: value });
}

/**
 * `export_vc_download` (wasm_bindgen extern into `views/script.js`): triggers
 * a browser download of the VC JSON via `window.ratel.credentials.export_vc`,
 * which the page's legacy script (loaded through `useLegacyScript`) defines.
 */
export function exportVcDownload(json: string): void {
  const ns = (window as unknown as { ratel?: { credentials?: { export_vc?: (j: string) => void } } }).ratel?.credentials;
  ns?.export_vc?.(json);
}
