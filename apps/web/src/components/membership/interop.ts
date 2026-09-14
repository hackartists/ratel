// app/ratel/src/features/membership/interop (+ web/*.js drivers) and the
// `enterprise_contact` helper of the team subscription page. The PortOne call
// goes to `window.ratel.membership.requestIdentityVerification`, defined by
// the unmodified app/ratel/js/src/ratel-app-shell/membership/index.js that the
// app shell loads globally.

interface RatelMembershipJs {
  requestIdentityVerification(storeId: string, channelKey: string, prefix: string): Promise<string>;
}

interface TauriInternals {
  invoke<R>(cmd: string, args?: Record<string, unknown>): Promise<R>;
}

type MembershipWindow = Window & {
  ratel?: { membership?: RatelMembershipJs };
  __TAURI_INTERNALS__?: TauriInternals;
  isTauri?: boolean;
  __ratelInitialSearch?: string;
};

const win = () => window as MembershipWindow;

/** `request_identity_verification` — resolves with the identity verification id. */
export function requestIdentityVerification(storeId: string, channelKey: string, prefix: string): Promise<string> {
  const js = win().ratel?.membership;
  if (!js) return Promise.reject(new Error("window.ratel.membership is not loaded"));
  return js.requestIdentityVerification(storeId, channelKey, prefix);
}

/** `stash_membership_tier` (web/stash_membership_tier.js). Tauri only. */
export function stashMembershipTier(tier: string): void {
  try {
    const w = win();
    if (w.__TAURI_INTERNALS__ || w.isTauri) {
      w.sessionStorage.setItem("ratel_membership_tier", tier);
    }
  } catch {
    // Storage unavailable: nothing to resume.
  }
}

/** `take_membership_return` (web/take_membership_return.js): `[identityVerificationId, tier]` once. */
export function takeMembershipReturn(): [string, string] | null {
  try {
    const w = win();
    let search = w.__ratelInitialSearch;
    if (search == null) search = w.location.search || "";
    w.__ratelInitialSearch = "";
    const params = new URLSearchParams(search);
    const id = params.get("identityVerificationId");
    const code = params.get("code");
    const tier = w.sessionStorage.getItem("ratel_membership_tier");
    w.sessionStorage.removeItem("ratel_membership_tier");
    w.sessionStorage.removeItem("ratel_kyc_hist_len");
    return id && !code && tier ? [id, tier] : null;
  } catch {
    return null;
  }
}

/**
 * `enterprise_contact`: a mailto to hi@ratel.foundation. The Android/iOS
 * WebView ignores `window.open("mailto:…")`, so the Tauri build asks the
 * opener plugin to hand it to the mail app.
 */
export function openEnterpriseContact(): void {
  const email = "hi@ratel.foundation";
  const subject = "Enterprise Membership Inquiry";
  const body =
    "Hello,%0D%0A%0D%0AI would like to learn more about the Enterprise membership plan for our team.%0D%0A%0D%0AThank you.";
  const mailtoUrl = `mailto:${email}?subject=${subject}&body=${body}`;
  const tauri = win().__TAURI_INTERNALS__;
  if (import.meta.env.VITE_TAURI === "1" && typeof tauri?.invoke === "function") {
    tauri.invoke("plugin:opener|open_url", { url: mailtoUrl }).catch((e: unknown) => {
      console.error(`open enterprise contact mailto failed: ${String(e)}`);
    });
    return;
  }
  window.open(mailtoUrl);
}
