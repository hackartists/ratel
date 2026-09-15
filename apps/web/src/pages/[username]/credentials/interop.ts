// The credentials interop of the former Dioxus app and its `web/*.js` drivers,
// as plain browser APIs — the behavior (reading the PortOne redirect return,
// popping PG pages from history, starting PortOne identity verification through
// `@/lib/portone-identity`) is unchanged.
import { signAttributesHandler } from "@ratel/ts-bridges";
import type { CredentialResponse } from "@ratel/ts-bridges";
import { requestCredentialIdentityVerification } from "@/lib/portone-identity";

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
 * `interop::verify_identity`: opens the PortOne identity-verification flow
 * (`@/lib/portone`), then finalizes the resulting credential.
 * Testing builds (`VITE_BYPASS=true`, Rust `cfg(feature = "bypass")`) skip
 * PortOne and sign an empty id, which a `bypass` backend accepts.
 */
export async function verifyIdentity(storeId: string, channelKey: string, prefix: string): Promise<CredentialResponse> {
  if (import.meta.env.VITE_BYPASS === "true") return signAttributesHandler({ type: "port_one", id: "" });
  let value: unknown;
  try {
    value = await requestCredentialIdentityVerification(storeId, channelKey, prefix);
  } catch {
    throw new PortOneError("request_failed");
  }
  if (typeof value !== "string") {
    throw new PortOneError("invalid_identity");
  }
  return signAttributesHandler({ type: "port_one", id: value });
}

/** `export_vc_download`: the same VC JSON download as `/credentials`. */
export { exportVcDownload } from "@/pages/credentials/hooks/kyc";
