// PortOne identity verification. The PortOne browser SDK itself still comes
// from the `cdn.portone.io` <script> in index.html (`window.PortOne`); these are
// the two wrappers the former global bundle exposed (shell-js
// `ratel-app-shell/membership/index.js` and `users/credential.js`), moved here
// unchanged. They differ in what they resolve to, and callers depend on it, so
// they stay separate:
//   - membership: the id generated here, whatever PortOne resolves with;
//   - credential: `identityVerificationId` from PortOne's response.
//
// In a Tauri WebView PortOne cannot open a popup: it navigates the whole window
// to the PG page and comes back through `redirectUrl` (without it the WebView is
// stuck on the iamport page). The history depth is saved so the return handler
// can pop the PG pages (`clearKycHistory`). Desktop keeps the popup payload.

interface PortOneSdk {
  requestIdentityVerification(payload: Record<string, unknown>): Promise<{ identityVerificationId?: unknown } | undefined>;
}

interface PortOneWindow {
  PortOne?: Partial<PortOneSdk>;
  __TAURI_INTERNALS__?: unknown;
  isTauri?: unknown;
}

const portOneWindow = () => window as unknown as PortOneWindow;

function newIdentityVerificationId(prefix: string, randomMax: number): string {
  const randomId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.floor(Math.random() * randomMax)}`;
  return `iv-${prefix}-${randomId}`;
}

function addWebViewRedirect(payload: Record<string, unknown>): void {
  const w = portOneWindow();
  if (!(w.__TAURI_INTERNALS__ || w.isTauri)) return;
  payload.redirectUrl = window.location.origin + window.location.pathname;
  try {
    window.sessionStorage.setItem("ratel_kyc_hist_len", String(window.history.length));
  } catch {
    // storage blocked
  }
}

/** Membership flow (former `window.ratel.membership.requestIdentityVerification`). */
export function requestMembershipIdentityVerification(
  storeId: string,
  channelKey: string,
  prefix: string,
): Promise<string> {
  const sdk = portOneWindow().PortOne;
  if (!sdk || !sdk.requestIdentityVerification) {
    return Promise.reject(new Error("PortOne SDK is not available"));
  }
  const identityVerificationId = newIdentityVerificationId(prefix, 1000000);
  const payload: Record<string, unknown> = { storeId, identityVerificationId, channelKey };
  addWebViewRedirect(payload);
  return sdk.requestIdentityVerification(payload).then(() => identityVerificationId);
}

/** Credential flow (former `window.ratel.user_credential.request_identity_verification`). */
export async function requestCredentialIdentityVerification(
  storeId: string,
  channelKey: string,
  prefix: string,
): Promise<unknown> {
  const sdk = portOneWindow().PortOne;
  if (!sdk || !sdk.requestIdentityVerification) {
    return Promise.reject(new Error("PortOne SDK not loaded"));
  }
  const identityVerificationId = newIdentityVerificationId(prefix, 1e9);
  const payload: Record<string, unknown> = { storeId, identityVerificationId, channelKey };
  addWebViewRedirect(payload);
  const res = await sdk.requestIdentityVerification(payload);
  return res?.identityVerificationId;
}
