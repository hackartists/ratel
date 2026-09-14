// app/ratel/src/features/social/pages/credentials/interop — the PortOne
// identity-verification binding and the two `document::eval` drivers
// (interop/web/take_pg_return.js, interop/web/kyc_clear_history.js) as plain
// async functions. Behaviour and storage keys are unchanged.

interface KycWindow {
  ratel?: {
    user_credential?: {
      request_identity_verification?: (storeId: string, channelKey: string, prefix: string) => Promise<unknown>;
    };
  };
  __ratelInitialSearch?: string | null;
}

const kycWindow = () => window as unknown as KycWindow;

/**
 * Rust `request_identity_verification` (`window.ratel.user_credential`, from
 * js/src/ratel-app-shell/users/credential.js). Opens the PortOne SDK and
 * resolves to the `identityVerificationId`.
 */
export function requestIdentityVerification(storeId: string, channelKey: string, prefix: string): Promise<unknown> {
  const request = kycWindow().ratel?.user_credential?.request_identity_verification;
  if (typeof request !== "function") return Promise.reject(new Error("window.ratel.user_credential is not loaded"));
  return request(storeId, channelKey, prefix);
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

interface CredentialsScriptWindow {
  ratel?: { credentials?: { export_vc?: (json: string) => void } };
}

/** `window.ratel.credentials.export_vc` from the page's script.js (Rust wasm_bindgen extern). */
export function exportVcDownload(json: string): void {
  const exportVc = (window as unknown as CredentialsScriptWindow).ratel?.credentials?.export_vc;
  if (typeof exportVc !== "function") throw new Error("window.ratel.credentials.export_vc is not loaded");
  exportVc(json);
}
