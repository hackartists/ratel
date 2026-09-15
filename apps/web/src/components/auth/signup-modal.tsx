import * as React from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "@ratel/ts-bridges/runtime";
import { useEnumI18n } from "@/i18n/generated/enums.i18n";
import { useSignupModalI18n } from "@/i18n/generated/features/auth/components/sign_up_modal/signup-modal.i18n";
import { usePopup } from "@/lib/popup";
import { LocalAuthError, serverErrorText } from "./interop";
import { useAuthActions, type SignupProfile } from "./use-auth-actions";

// app/ratel/src/features/auth/components/sign_up_modal/mod.rs (`SignupModal`).
// Opened by the login modal when the email code, Google token or wallet
// belongs to no account. A code handed over from the login flow is already
// verified, so the email is locked; a Google sign-up skips email verification.
// A fresh sign-up lands on the cross-posting onboarding page.

const RATEL_LOGO = "/assets/ratel_new_logo.png";
const DEFAULT_PROFILE_URL = "https://metadata.ratel.foundation/ratel/default-profile.png";

const TEXT_INPUT_CLASS =
  "flex px-5 w-full min-w-0 h-11 text-base font-medium placeholder-gray-500 rounded-lg border outline-none disabled:opacity-50 disabled:cursor-not-allowed bg-input-box-bg border-input-box-border text-text-primary";
const SMALL_BUTTON_CLASS =
  "inline-flex gap-2.5 justify-center items-center py-1.5 px-4 h-auto text-xs font-bold whitespace-nowrap rounded-full transition-all outline-none disabled:opacity-50 disabled:pointer-events-none bg-btn-secondary-bg text-btn-secondary-text border-btn-secondary-outline hover:bg-btn-secondary-hover-bg hover:text-btn-secondary-hover-text";
const LABEL_CLASS = "font-bold text-c-cg-30 text-base/7";
const FOOTER_LINK_CLASS = "p-0 font-medium bg-transparent border-none cursor-pointer text-neutral-400 text-xs/3.5";

const isValidEmailFormat = (email: string) => {
  const parts = email.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  return local !== "" && domain !== "" && domain.includes(".") && !/\s/.test(local) && !/\s/.test(domain);
};

const isValidUsername = (name: string) => name !== "" && /^[a-z0-9_-]+$/.test(name);

export interface SignupModalProps {
  initialEmail?: string;
  /** A code already validated by the login flow: the email is trusted and reused. */
  initialEmailCode?: string;
  initialOauthAccessToken?: string;
  initialWalletAddress?: string;
  onSuccess?: () => void;
}

export function SignupModal({
  initialEmail,
  initialEmailCode,
  initialOauthAccessToken,
  initialWalletAddress,
  onSuccess,
}: SignupModalProps) {
  const tr = useSignupModalI18n();
  const enumText = useEnumI18n();
  const popup = usePopup();
  const navigate = useNavigate();
  const actions = useAuthActions();

  const isWalletSignup = initialWalletAddress !== undefined;
  const isOauthSignup = initialOauthAccessToken !== undefined;
  const emailPrefilled = initialEmailCode !== undefined;
  const walletAddress = initialWalletAddress ?? "";
  const oauthAccessToken = initialOauthAccessToken ?? "";

  const [email, setEmail] = React.useState(initialEmail ?? "");
  const [displayName, setDisplayName] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [authCode, setAuthCode] = React.useState(initialEmailCode ?? "");
  const [agreedTos, setAgreedTos] = React.useState(false);
  const [agreedNews, setAgreedNews] = React.useState(false);
  const [sentCode, setSentCode] = React.useState(emailPrefilled);
  const [isValidEmail, setIsValidEmail] = React.useState(isOauthSignup || emailPrefilled);
  const [loading, setLoading] = React.useState(false);
  const [emailWarning, setEmailWarning] = React.useState("");
  const [usernameWarning, setUsernameWarning] = React.useState("");
  const [termsError, setTermsError] = React.useState("");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const submitDisabled =
    !agreedTos ||
    username === "" ||
    !isValidUsername(username) ||
    displayName.trim() === "" ||
    (!isWalletSignup && !isValidEmail);

  const errorText = (e: unknown) =>
    e instanceof LocalAuthError
      ? e.variant === "WalletConnectFailed"
        ? enumText("AuthError", "WalletConnectFailed")
        : enumText("Error", "OnlyWebFunction")
      : serverErrorText(e);

  const handleSendCode = async () => {
    if (!isValidEmailFormat(email)) {
      setEmailWarning(tr.invalidEmailFormat);
      return;
    }
    setEmailWarning("");
    setLoading(true);
    try {
      await actions.sendEmailCode(email);
      setLoading(false);
      setSentCode(true);
    } catch (e) {
      setLoading(false);
      if (e instanceof ApiError && e.is("Duplicate")) setEmailWarning(tr.emailAlreadyRegistered);
      else setEmailWarning(`${tr.failedSendCode}: ${errorText(e)}`);
    }
  };

  const handleVerifyCode = async () => {
    setLoading(true);
    try {
      const resp = await actions.verifyEmailCode(email, authCode);
      setLoading(false);
      if (resp.success) setIsValidEmail(true);
      else setEmailWarning(tr.failedVerifyCode);
    } catch (e) {
      setLoading(false);
      setEmailWarning(`${tr.failedVerifyCode}: ${errorText(e)}`);
    }
  };

  const handleSubmit = async () => {
    setTermsError("");
    setErrorMessage(null);

    if (displayName.trim() === "") return;
    if (username === "" || !isValidUsername(username)) return;
    if (!agreedTos) {
      setTermsError(tr.termsRequired);
      return;
    }

    setLoading(true);
    const profile: SignupProfile = {
      display_name: displayName,
      username,
      profile_url: DEFAULT_PROFILE_URL,
      term_agreed: agreedTos,
      informed_agreed: agreedNews,
    };

    try {
      if (isWalletSignup) {
        await actions.signupWithWallet(walletAddress, profile);
      } else {
        const method = isOauthSignup
          ? { provider: "Google", access_token: oauthAccessToken }
          : { email, code: authCode };
        await actions.signup(method, profile);
      }
    } catch (e) {
      setLoading(false);
      if (e instanceof ApiError && e.is("UsernameAlreadyExists")) setUsernameWarning(tr.usernameAlreadyExists);
      else setErrorMessage(errorText(e));
      return;
    }

    setLoading(false);
    onSuccess?.();
    popup.close();
    // FR-2 #8 — a fresh sign-up lands on the cross-posting onboarding interstitial.
    navigate("/onboarding/connections", { replace: true });
  };

  const goTo = (path: string) => {
    popup.close();
    navigate(path);
  };

  return (
    <div className="overflow-y-scroll w-full max-h-[80vh] momentum scrollbar-hide" id="signup_popup">
      <div className="flex flex-col gap-4 mx-auto w-full max-w-100">
        <div className="flex justify-center">
          <img src={RATEL_LOGO} alt="Ratel" className="object-contain h-10" />
        </div>

        {errorMessage !== null && <div className="text-sm text-red-500">{errorMessage}</div>}

        {isWalletSignup && (
          <div className="flex flex-col w-full gap-1.25">
            <label className={LABEL_CLASS}>{tr.walletAddress}</label>
            <div className="flex items-center px-5 w-full h-11 text-base font-medium rounded-lg border opacity-70 bg-input-box-bg border-input-box-border text-text-primary">
              {`${walletAddress.slice(0, 6)}...${walletAddress.slice(walletAddress.length - 4)}`}
            </div>
          </div>
        )}

        {/* Email + verification code (hidden for wallet sign-up). */}
        <div className={isWalletSignup ? "hidden" : "flex flex-col w-full gap-1.25"}>
          <label className={LABEL_CLASS}>{tr.email}</label>
          <div className="flex flex-row gap-2.5 items-center w-full">
            <input
              autoComplete="email"
              className={TEXT_INPUT_CLASS}
              disabled={loading || isValidEmail}
              name="email"
              placeholder={tr.emailPlaceholder}
              type="email"
              value={email}
              onChange={(e) => {
                const val = e.target.value;
                setEmail(val);
                setEmailWarning(val !== "" && !isValidEmailFormat(val) ? tr.invalidEmailFormat : "");
              }}
            />
            {!isValidEmail && (
              <button className={SMALL_BUTTON_CLASS} disabled={loading} onClick={() => void handleSendCode()}>
                {tr.send}
              </button>
            )}
          </div>
          {emailWarning !== "" && <p className="mt-1 text-sm text-red-500">{emailWarning}</p>}

          <div
            aria-hidden={!sentCode || isValidEmail ? "true" : "false"}
            className="flex flex-row gap-2.5 items-center w-full aria-hidden:hidden"
          >
            <input
              className={TEXT_INPUT_CLASS}
              disabled={loading}
              name="otp"
              placeholder={tr.codePlaceholder}
              type="text"
              value={authCode}
              onChange={(e) => setAuthCode(e.target.value)}
            />
            <button className={SMALL_BUTTON_CLASS} disabled={loading} onClick={() => void handleVerifyCode()}>
              {tr.verify}
            </button>
          </div>
        </div>

        <div className="flex flex-col w-full gap-1.25">
          <label className={LABEL_CLASS}>{tr.displayName}</label>
          <input
            className={TEXT_INPUT_CLASS}
            disabled={loading}
            placeholder={tr.displayNamePlaceholder}
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>

        <div className="flex flex-col w-full gap-1.25">
          <label className={LABEL_CLASS}>{tr.userName}</label>
          <input
            className={TEXT_INPUT_CLASS}
            disabled={loading}
            placeholder={tr.usernamePlaceholder}
            type="text"
            value={username}
            onChange={(e) => {
              const val = e.target.value;
              setUsername(val);
              setUsernameWarning(val !== "" && !isValidUsername(val) ? tr.invalidUsernameFormat : "");
              setErrorMessage(null);
            }}
          />
          {usernameWarning !== "" && <p className="mt-1 text-sm text-c-p-50 light:text-red-600">{usernameWarning}</p>}
        </div>

        <div className="flex flex-col items-start mt-5 mb-5 gap-2.25">
          <label className="flex flex-row gap-2 items-center cursor-pointer">
            <input
              type="checkbox"
              checked={agreedTos}
              onChange={(e) => {
                setAgreedTos(e.target.checked);
                if (e.target.checked) setTermsError("");
              }}
            />
            <span className="text-sm text-gray-400">
              <strong>{tr.agreeTosRequired}</strong>
              {tr.agreeTosText}
            </span>
          </label>
          {termsError !== "" && <p className="-mt-1 text-sm text-red-500">{termsError}</p>}
          <label className="flex flex-row gap-2 items-center cursor-pointer">
            <input type="checkbox" checked={agreedNews} onChange={(e) => setAgreedNews(e.target.checked)} />
            <span className="text-sm text-gray-400">{tr.agreeNews}</span>
          </label>
        </div>

        <button
          className="flex justify-center items-center py-3 px-5 w-full font-bold rounded-lg transition-all disabled:opacity-50 disabled:pointer-events-none text-submit-button-text bg-primary hover:bg-primary/90"
          disabled={submitDisabled || loading}
          onClick={() => void handleSubmit()}
        >
          {loading ? tr.loading : tr.finishSignup}
        </button>

        <div className="flex flex-row gap-2.5 justify-center items-center w-full">
          <button className={FOOTER_LINK_CLASS} onClick={() => goTo("/privacy")}>
            {tr.privacyPolicy}
          </button>
          <button className={FOOTER_LINK_CLASS} onClick={() => goTo("/terms")}>
            {tr.termsOfService}
          </button>
          <button className={FOOTER_LINK_CLASS} onClick={() => goTo("/child-safety")}>
            {tr.childSafety}
          </button>
        </div>
      </div>
    </div>
  );
}
