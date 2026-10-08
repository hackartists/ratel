import * as React from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "@ratel/ts-bridges/runtime";
import { Button, ButtonShape } from "@/components/ui/button";
import { Input, InputType } from "@/components/ui/input";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { WalletConnect } from "@/components/icons/wallet";
import { useEnumI18n } from "@/i18n/enums.i18n";
import { useLoginModalI18n } from "./login-modal.i18n";
import { isAndroid, isIos } from "@/lib/platform";
import { usePopup } from "@/lib/popup";
import {
  googleSignIn,
  initFirebase,
  LocalAuthError,
  serverErrorText,
  walletConnect,
  walletInitialize,
  walletOpenApp,
  walletSignMessage,
  warmUpGoogleSignIn,
  warmUpWalletConnect,
} from "./interop";
import { SignupModal } from "./signup-modal";
import { useAuthActions } from "./use-auth-actions";

// app/ratel/src/features/auth/components/login_modal/mod.rs (`LoginModal`).
//
// Email code flow: the first Continue sends a code and reveals the code field;
// the second verifies it and logs in. A valid code for an unknown email comes
// back as `Auth::UserNotFound`, which swaps this popup for the sign-up modal
// (the code stays usable within its window). Google and wallet sign-in follow
// the same "unknown account → sign-up" rule.

const RATEL_LOGO = "/assets/ratel_new_logo.png";

// Verbatim from the RSX, including the literal `&amp;` inside the arbitrary
// variants (RSX string literals don't decode entities) and the
// `btn-secondary--disable-bg` typo.
const CONTINUE_BUTTON_CLASS =
  "inline-flex gap-2.5 justify-center items-center py-1.5 px-4 h-auto text-xs font-bold whitespace-nowrap rounded-full transition-all outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none [&amp;_svg]:pointer-events-none [&amp;_svg]:size-[15px] shrink-0 [&amp;_svg]:shrink-0 font-[var(--font-raleway)] bg-btn-secondary-bg text-btn-secondary-text border-btn-secondary-outline web light:bg-neutral-600 hover:bg-btn-secondary-hover-bg hover:border-btn-secondary-hover-outline hover:text-btn-secondary-hover-text disabled:bg-btn-secondary--disable-bg disabled:border-btn-secondary-disable-outline disabled:text-btn-secondary-disable-text";

const FOOTER_LINK_CLASS = "p-0 font-medium bg-transparent border-none cursor-pointer text-neutral-400 text-xs/3.5";

type WalletStep = "None" | "WaitingSignature" | "Done";

export interface LoginModalProps {
  onSuccess?: () => void;
}

export function LoginModal({ onSuccess }: LoginModalProps) {
  const tr = useLoginModalI18n();
  const enumText = useEnumI18n();
  const popup = usePopup();
  const navigate = useNavigate();
  const actions = useAuthActions();

  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [showCode, setShowCode] = React.useState(false);
  const [loginMethod, setLoginMethod] = React.useState<"email" | "phone">("email");
  const [phone, setPhone] = React.useState("");
  const [phoneCode, setPhoneCode] = React.useState("");
  const [showPhoneCode, setShowPhoneCode] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [walletStep, setWalletStep] = React.useState<WalletStep>("None");
  // Read once, like the Rust `use_signal(|| is_ios())`.
  const [ios] = React.useState(isIos);
  const [android] = React.useState(isAndroid);

  // Load the Firebase SDK as soon as the modal opens, so "Continue with Google"
  // reaches the popup inside the click's user gesture; the wallet SDK likewise,
  // so the first "Connect wallet" does not also wait for a download.
  React.useEffect(() => {
    warmUpGoogleSignIn();
    warmUpWalletConnect();
  }, []);

  const errorText = (e: unknown) =>
    e instanceof LocalAuthError
      ? e.variant === "WalletConnectFailed"
        ? enumText("AuthError", "WalletConnectFailed")
        : enumText("Error", "OnlyWebFunction")
      : serverErrorText(e);

  const isUserNotFound = (e: unknown) => e instanceof ApiError && e.is("Auth", "UserNotFound");

  const openSignup = (props: React.ComponentProps<typeof SignupModal>) => {
    popup.close();
    popup.open(<SignupModal {...props} onSuccess={onSuccess} />);
  };

  const finishLogin = () => {
    onSuccess?.();
    popup.close();
  };

  // Rust `submit_email_login`, shared by Continue and Enter in either field.
  const submitEmailLogin = async () => {
    setErrorMessage(null);

    if (!showCode) {
      setLoading(true);
      try {
        await actions.sendEmailCode(email);
        setLoading(false);
        setShowCode(true);
      } catch (e) {
        setLoading(false);
        setErrorMessage(errorText(e));
      }
      return;
    }

    setLoading(true);
    try {
      await actions.loginWithEmail(email, code);
      setLoading(false);
      finishLogin();
    } catch (e) {
      setLoading(false);
      if (isUserNotFound(e)) openSignup({ initialEmail: email, initialEmailCode: code });
      else setErrorMessage(errorText(e));
    }
  };

  // Phone login: enter phone → send code → enter code → submit. Unlike email,
  // a successful `loginWithPhone` handles both brand-new and returning users
  // (the account is auto-created server-side), so there is no
  // `UserNotFound`-to-signup branch here.
  const submitPhoneLogin = async () => {
    setErrorMessage(null);

    if (!showPhoneCode) {
      setLoading(true);
      try {
        await actions.sendPhoneCode(phone);
        setLoading(false);
        setShowPhoneCode(true);
      } catch (e) {
        setLoading(false);
        setErrorMessage(errorText(e));
      }
      return;
    }

    setLoading(true);
    try {
      await actions.loginWithPhone(phone, phoneCode);
      setLoading(false);
      finishLogin();
    } catch (e) {
      setLoading(false);
      setErrorMessage(errorText(e));
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMessage(null);
    await initFirebase();
    setLoading(true);

    let userInfo;
    try {
      userInfo = await googleSignIn();
    } catch (e) {
      setLoading(false);
      setErrorMessage(errorText(e));
      return;
    }

    const oauthEmail = userInfo.email && userInfo.email.trim() ? userInfo.email : undefined;
    try {
      await actions.loginWithGoogle(userInfo.access_token);
      setLoading(false);
      finishLogin();
    } catch (e) {
      setLoading(false);
      if (isUserNotFound(e)) openSignup({ initialEmail: oauthEmail, initialOauthAccessToken: userInfo.access_token });
      else setErrorMessage(errorText(e));
    }
  };

  const handleWalletLogin = async () => {
    setErrorMessage(null);
    setLoading(true);
    walletInitialize();

    let address: string;
    try {
      address = (await walletConnect()).address;
    } catch (e) {
      setLoading(false);
      setErrorMessage(errorText(e));
      return;
    }

    let exists: boolean;
    try {
      exists = (await actions.walletCheck(address)).exists;
    } catch (e) {
      setLoading(false);
      setErrorMessage(errorText(e));
      return;
    }

    if (!exists) {
      setLoading(false);
      openSignup({ initialWalletAddress: address });
      return;
    }

    let message: string;
    try {
      message = (await actions.walletNonce()).message;
    } catch (e) {
      setLoading(false);
      setErrorMessage(errorText(e));
      return;
    }

    setWalletStep("WaitingSignature");

    let signature: string;
    try {
      signature = await walletSignMessage(message);
    } catch (e) {
      setLoading(false);
      setWalletStep("None");
      setErrorMessage(errorText(e));
      return;
    }

    setWalletStep("Done");

    try {
      await actions.loginWithWallet(signature, address, message);
      setLoading(false);
      setWalletStep("None");
      finishLogin();
    } catch (e) {
      setLoading(false);
      setWalletStep("None");
      setErrorMessage(errorText(e));
    }
  };

  const goTo = (path: string) => {
    popup.close();
    navigate(path);
  };

  return (
    <div
      className="flex flex-col gap-5 w-100 max-w-100 mx-1.25 max-mobile:w-full! max-mobile:max-w-full!"
      id="login_popup"
    >
      {walletStep === "WaitingSignature" ? (
        <div className="flex absolute inset-0 flex-col gap-10 justify-center items-center p-5 w-full h-full bg-background z-1">
          <div className="flex flex-col justify-between w-full h-full max-h-200">
            <div className="flex flex-col gap-4 w-full">
              <p className="text-xl font-semibold text-center text-text-primary">{tr.waitingWalletSignature}</p>
              <p className="text-base text-center text-muted-foreground">{tr.waitingWalletDescription}</p>
            </div>
            <Button
              className="w-full"
              shape={ButtonShape.Square}
              onClick={() => {
                void walletOpenApp().catch(() => undefined);
              }}
            >
              {tr.openWallet}
            </Button>
          </div>
        </div>
      ) : (
        loading && (
          <div className="flex absolute inset-0 justify-center items-center w-full h-full bg-background/95">
            <LoadingIndicator className="size-8" />
          </div>
        )
      )}
      <img src={RATEL_LOGO} alt="Ratel" className="object-contain h-10" />

      <div className="flex flex-col gap-4 w-full">
        {errorMessage !== null && <div className="text-sm text-red-500">{errorMessage}</div>}

        {loginMethod === "email" ? (
          <>
            <div className="flex flex-col gap-2.5 w-full">
              <label htmlFor="email" className="text-sm">
                {tr.emailAddress}
              </label>
              <div className="relative w-full">
                <Input
                  id="email"
                  name="username"
                  autoComplete="email"
                  data-slot="input"
                  data-testid="email-input"
                  disabled={loading}
                  placeholder={tr.emailPlaceholder}
                  type={InputType.Email}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onConfirm={() => void submitEmailLogin()}
                />
              </div>
            </div>
            <div aria-hidden={showCode ? "false" : "true"} className="flex flex-col gap-2.5 w-full aria-hidden:hidden">
              <label htmlFor="code" className="text-sm">
                {tr.verificationCode}
              </label>
              <div className="relative w-full">
                <Input
                  id="code"
                  name="one-time-code"
                  autoComplete="one-time-code"
                  data-slot="input"
                  data-testid="code-input"
                  disabled={loading}
                  placeholder={tr.codePlaceholder}
                  type={InputType.Text}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onConfirm={() => void submitEmailLogin()}
                />
              </div>
            </div>
            <div className="flex flex-row gap-2.5 justify-end items-center w-full text-sm">
              <button
                className={CONTINUE_BUTTON_CLASS}
                data-slot="button"
                data-testid="continue-button"
                disabled={loading}
                onClick={() => void submitEmailLogin()}
              >
                {loading ? tr.loading : tr.continueBtn}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-2.5 w-full">
              <label htmlFor="phone" className="text-sm">
                {tr.phoneNumber}
              </label>
              <div className="relative w-full">
                <Input
                  id="phone"
                  name="tel"
                  autoComplete="tel"
                  data-slot="input"
                  data-testid="phone-input"
                  disabled={loading}
                  placeholder={tr.phonePlaceholder}
                  type={InputType.Text}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onConfirm={() => void submitPhoneLogin()}
                />
              </div>
            </div>
            <div
              aria-hidden={showPhoneCode ? "false" : "true"}
              className="flex flex-col gap-2.5 w-full aria-hidden:hidden"
            >
              <label htmlFor="phone-code" className="text-sm">
                {tr.verificationCode}
              </label>
              <div className="relative w-full">
                <Input
                  id="phone-code"
                  name="one-time-code"
                  autoComplete="one-time-code"
                  data-slot="input"
                  data-testid="phone-code-input"
                  disabled={loading}
                  placeholder={tr.codePlaceholder}
                  type={InputType.Text}
                  value={phoneCode}
                  onChange={(e) => setPhoneCode(e.target.value)}
                  onConfirm={() => void submitPhoneLogin()}
                />
              </div>
            </div>
            <div className="flex flex-row gap-2.5 justify-end items-center w-full text-sm">
              <button
                className={CONTINUE_BUTTON_CLASS}
                data-slot="button"
                data-testid="phone-continue-button"
                disabled={loading}
                onClick={() => void submitPhoneLogin()}
              >
                {loading ? tr.loading : tr.continueBtn}
              </button>
            </div>
          </>
        )}
        <div className="flex flex-row justify-center items-center w-full">
          <button
            className={FOOTER_LINK_CLASS}
            data-testid="toggle-login-method"
            disabled={loading}
            onClick={() => {
              setErrorMessage(null);
              setLoginMethod(loginMethod === "email" ? "phone" : "email");
            }}
          >
            {loginMethod === "email" ? tr.usePhoneInstead : tr.useEmailInstead}
          </button>
        </div>
      </div>
      {/* The "Or" divider only makes sense when a social login follows it. */}
      {!ios && <div className="font-light text-center rule-with-text align-center">{tr.or}</div>}
      <div className="flex flex-col gap-2.5">
        {!ios && (
          <button
            className="flex flex-row gap-5 items-center px-5 w-full cursor-pointer rounded-[10px] bg-[#000203] py-5.5"
            disabled={loading}
            onClick={() => void handleGoogleLogin()}
          >
            <svg fill="none" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
              <g clipPath="url(#clip0_2052_51930)">
                <path
                  d="M21.7623 12.1871C21.7623 11.3677 21.6958 10.7697 21.552 10.1497H12.1953V13.848H17.6874C17.5768 14.7671 16.9788 16.1512 15.65 17.0813L15.6314 17.2051L18.5898 19.4969L18.7948 19.5174C20.6771 17.7789 21.7623 15.221 21.7623 12.1871Z"
                  fill="#4285F4"
                />
                <path
                  d="M12.1937 21.9313C14.8844 21.9313 17.1432 21.0454 18.7932 19.5174L15.6484 17.0813C14.8069 17.6682 13.6774 18.0779 12.1937 18.0779C9.55834 18.0779 7.32163 16.3395 6.5243 13.9366L6.40743 13.9466L3.33124 16.3273L3.29102 16.4391C4.92979 19.6945 8.29598 21.9313 12.1937 21.9313Z"
                  fill="#34A853"
                />
                <path
                  d="M6.52477 13.9366C6.31439 13.3165 6.19264 12.6521 6.19264 11.9656C6.19264 11.279 6.31439 10.6147 6.51371 9.9946L6.50813 9.86253L3.3934 7.4436L3.29149 7.49208C2.61607 8.84299 2.22852 10.36 2.22852 11.9656C2.22852 13.5712 2.61607 15.0881 3.29149 16.439L6.52477 13.9366Z"
                  fill="#FBBC05"
                />
                <path
                  d="M12.1937 5.85336C14.065 5.85336 15.3273 6.66168 16.047 7.33718L18.8596 4.59107C17.1322 2.9855 14.8844 2 12.1937 2C8.29598 2 4.92979 4.23672 3.29102 7.49214L6.51323 9.99466C7.32163 7.59183 9.55834 5.85336 12.1937 5.85336Z"
                  fill="#EB4335"
                />
              </g>
              <defs>
                <clipPath id="clip0_2052_51930">
                  <rect fill="white" height="20" transform="translate(2 2)" width="20" />
                </clipPath>
              </defs>
            </svg>
            <div className="text-base font-semibold text-white">{tr.continueWithGoogle}</div>
          </button>
        )}
        {/* Wallet login is web-only: hidden on the native iOS and Android apps, plus narrow screens. */}
        {!ios && !android && (
          <button
            className="flex flex-row gap-5 items-center px-5 w-full cursor-pointer rounded-[10px] bg-[#3B99FC] py-5.5 max-mobile:hidden"
            disabled={loading}
            onClick={() => void handleWalletLogin()}
          >
            <WalletConnect className="fill-white" width="24" height="24" />
            <div className="text-base font-semibold text-white">{tr.continueWithWallet}</div>
          </button>
        )}
      </div>
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
  );
}
