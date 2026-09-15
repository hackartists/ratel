// app/ratel/src/features/membership/interop — the PortOne identity-verification
// binding and the two `document::eval` drivers
// (interop/web/stash_membership_tier.js, interop/web/take_membership_return.js)
// as plain async functions. Storage keys and behaviour are unchanged.

interface MembershipWindow {
  ratel?: {
    membership?: {
      requestIdentityVerification?: (storeId: string, channelKey: string, prefix: string) => Promise<unknown>;
    };
  };
  __ratelInitialSearch?: string | null;
  __TAURI_INTERNALS__?: unknown;
  isTauri?: unknown;
}

const membershipWindow = () => window as unknown as MembershipWindow;

/**
 * Rust `request_identity_verification` (`window.ratel.membership.requestIdentityVerification`,
 * js/src/ratel-app-shell/membership/index.js). Opens the PortOne SDK and
 * resolves to the `identityVerificationId`.
 */
export function requestIdentityVerification(storeId: string, channelKey: string, prefix: string): Promise<unknown> {
  const request = membershipWindow().ratel?.membership?.requestIdentityVerification;
  if (typeof request !== "function") return Promise.reject(new Error("window.ratel.membership is not loaded"));
  return request(storeId, channelKey, prefix);
}

/** stash_membership_tier.js: remember the tier across the WebView redirect (Tauri only). */
export async function stashMembershipTier(tier: string): Promise<void> {
  try {
    const w = membershipWindow();
    if (w.__TAURI_INTERNALS__ || w.isTauri) window.sessionStorage.setItem("ratel_membership_tier", tier);
  } catch {
    // storage blocked
  }
}

/**
 * take_membership_return.js: `[identityVerificationId, tier]` after a
 * WebView/mobile redirect back to /membership, once (markers cleared). `null`
 * on desktop.
 */
export async function takeMembershipReturn(): Promise<[string, string] | null> {
  try {
    const w = membershipWindow();
    let search = w.__ratelInitialSearch;
    if (search == null) search = window.location.search || "";
    w.__ratelInitialSearch = "";
    const params = new URLSearchParams(search);
    const id = params.get("identityVerificationId");
    const code = params.get("code");
    const tier = window.sessionStorage.getItem("ratel_membership_tier");
    window.sessionStorage.removeItem("ratel_membership_tier");
    window.sessionStorage.removeItem("ratel_kyc_hist_len");
    if (id && !code && tier) return [id, tier];
    return null;
  } catch {
    return null;
  }
}
