// app/ratel/src/features/social/pages/credentials/interop — the PortOne
// identity-verification binding and the two `document::eval` drivers
// (interop/web/take_pg_return.js, interop/web/kyc_clear_history.js) as plain
// async functions. Behaviour and storage keys are unchanged.

import { isTauri, saveFile } from "@/lib/native";
import { requestCredentialIdentityVerification } from "@/lib/portone-identity";

interface KycWindow {
  __ratelInitialSearch?: string | null;
}

const kycWindow = () => window as unknown as KycWindow;

/**
 * Rust `request_identity_verification`: opens the PortOne SDK and resolves to
 * the `identityVerificationId` PortOne returns (see `@/lib/portone`).
 */
export function requestIdentityVerification(storeId: string, channelKey: string, prefix: string): Promise<unknown> {
  return requestCredentialIdentityVerification(storeId, channelKey, prefix);
}

/**
 * take_pg_return.js: the `identityVerificationId` a WebView/mobile PortOne
 * redirect appended to the URL, once (the captured query is cleared). `null`
 * on desktop, where the popup flow leaves no query.
 */
export async function takePgReturnId(): Promise<string | null> {
  try {
    const w = kycWindow();
    let search = w.__ratelInitialSearch;
    if (search == null) search = window.location.search || "";
    w.__ratelInitialSearch = "";
    const params = new URLSearchParams(search);
    const id = params.get("identityVerificationId");
    const txType = params.get("transactionType");
    const code = params.get("code");
    if (id && !code && (!txType || txType === "IDENTITY_VERIFICATION")) return id;
    return null;
  } catch {
    return null;
  }
}

/**
 * kyc_clear_history.js: after the credential is finalized, pops the PG pages
 * the redirect stacked (depth saved by `request_identity_verification` under
 * `ratel_kyc_hist_len`) and strips the query. Resolves `true` when it went back.
 */
export async function clearKycHistory(): Promise<boolean> {
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

const VC_FILE_NAME = "ratel-vc.json";
const VC_MIME = "application/json";

function copyVcFallback(json: string): void {
  navigator.clipboard?.writeText(json).catch(() => {});
}

/**
 * Rust `export_vc_download`: saves the VC JSON as `ratel-vc.json`, copying it
 * to the clipboard when the download can't start. The WebView in the mobile
 * app ignores `<a download>`, so Tauri saves through the native file command.
 */
export function exportVcDownload(json: string): void {
  if (isTauri()) {
    saveFile(VC_FILE_NAME, VC_MIME, new TextEncoder().encode(json)).catch(() => copyVcFallback(json));
    return;
  }
  try {
    const url = URL.createObjectURL(new Blob([json], { type: VC_MIME }));
    const a = document.createElement("a");
    a.href = url;
    a.download = VC_FILE_NAME;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    copyVcFallback(json);
  }
}
