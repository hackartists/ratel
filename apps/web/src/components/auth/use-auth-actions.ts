// Controller for the login / sign-up modals: every API call they make, plus the
// `UserContext` update that follows a successful login or sign-up — exactly
// where the Rust modals call `user_ctx.set(UserContext { user, refresh_token,
// membership: None })` (login_modal/mod.rs, sign_up_modal/mod.rs).
//
// Components await these methods and decide the UX (close the popup, open the
// sign-up modal, show an error); they never touch the handlers.
import {
  useLogin,
  useSendCode,
  useSignup,
  useVerifyCode,
  useWalletCheck,
  useWalletNonce,
} from "@ratel/ts-bridges/hooks";
import type {
  LoginResponse,
  SignupRequest,
  SignupResponse,
  VerifyCodeResponse,
  WalletCheckResponse,
  WalletNonceResponse,
} from "@ratel/ts-bridges";
import { useAuth } from "@/lib/auth";
import { getOrCreateDeviceId, loginDeviceId, rememberRefreshToken, walletSignMessage } from "./interop";

/** `SignupRequest` minus the per-method `signup_type` fields and `device_id`. */
export interface SignupProfile {
  display_name: string;
  username: string;
  profile_url: string;
  term_agreed: boolean;
  informed_agreed: boolean;
}

export interface AuthActions {
  /** `send_code_handler(SendCodeRequest::Email)`. */
  sendEmailCode(email: string): Promise<void>;
  /** `verify_code_handler(VerifyCodeRequest::Email)`. */
  verifyEmailCode(email: string, code: string): Promise<VerifyCodeResponse>;
  /** `login_handler(LoginRequest::Email)`, then remembers the refresh token and signs in. */
  loginWithEmail(email: string, code: string): Promise<void>;
  /** `send_code_handler(SendCodeRequest::SMS)`. */
  sendPhoneCode(phone: string): Promise<void>;
  /**
   * `login_handler(LoginRequest::Phone)`, then remembers the refresh token and
   * signs in. Unlike email, a phone number with no account is auto-created
   * server-side (`login_with_phone`) — there is no separate phone signup step
   * and no `UserNotFound` branch to handle here.
   */
  loginWithPhone(phone: string, code: string): Promise<void>;
  /** `login_handler(LoginRequest::OAuth { provider: Google })`, then signs in. */
  loginWithGoogle(accessToken: string): Promise<void>;
  /** `wallet_check_handler`. */
  walletCheck(evmAddress: string): Promise<WalletCheckResponse>;
  /** `wallet_nonce_handler`. */
  walletNonce(): Promise<WalletNonceResponse>;
  /** `login_handler(LoginRequest::Wallet)`, then signs in (no refresh token is remembered, like Rust). */
  loginWithWallet(signature: string, evmAddress: string, message: string): Promise<void>;
  /** Email or Google sign-up: `signup_handler`, then remembers the refresh token and signs in. */
  signup(
    method: { email: string; code: string } | { provider: string; access_token: string },
    profile: SignupProfile,
  ): Promise<void>;
  /** Wallet sign-up: nonce → sign → `signup_handler`, then signs in. */
  signupWithWallet(evmAddress: string, profile: SignupProfile): Promise<void>;
}

export function useAuthActions(): AuthActions {
  const { setUserContext } = useAuth();
  const sendCode = useSendCode();
  const verifyCode = useVerifyCode();
  const login = useLogin();
  const signupMutation = useSignup();
  const walletCheck = useWalletCheck();
  const walletNonce = useWalletNonce();

  const signIn = ({ refresh_token, ...user }: LoginResponse | SignupResponse) =>
    setUserContext({ user, refreshToken: refresh_token, membership: null });

  const withProfile = (profile: SignupProfile, deviceId: string | null) => ({
    ...profile,
    description: "",
    phone_number: null,
    device_id: deviceId,
  });

  return {
    sendEmailCode: async (email) => {
      await sendCode.mutateAsync({ email });
    },
    verifyEmailCode: (email, code) => verifyCode.mutateAsync({ email, code }),
    loginWithEmail: async (email, code) => {
      const resp = await login.mutateAsync({ email, code, device_id: loginDeviceId() });
      rememberRefreshToken(resp.refresh_token);
      signIn(resp);
    },
    sendPhoneCode: async (phone) => {
      await sendCode.mutateAsync({ phone });
    },
    loginWithPhone: async (phone, code) => {
      const resp = await login.mutateAsync({ phone, code, device_id: loginDeviceId() });
      rememberRefreshToken(resp.refresh_token);
      signIn(resp);
    },
    loginWithGoogle: async (accessToken) => {
      const resp = await login.mutateAsync({ provider: "GOOGLE", access_token: accessToken, device_id: loginDeviceId() });
      rememberRefreshToken(resp.refresh_token);
      signIn(resp);
    },
    walletCheck: (evmAddress) => walletCheck.mutateAsync({ evm_address: evmAddress }),
    walletNonce: () => walletNonce.mutateAsync(),
    loginWithWallet: async (signature, evmAddress, message) => {
      const resp = await login.mutateAsync({
        signature,
        evm_address: evmAddress,
        message,
        device_id: getOrCreateDeviceId(),
      });
      signIn(resp);
    },
    signup: async (method, profile) => {
      const req = { ...withProfile(profile, loginDeviceId()), ...method } as SignupRequest;
      const resp = await signupMutation.mutateAsync(req);
      rememberRefreshToken(resp.refresh_token);
      signIn(resp);
    },
    signupWithWallet: async (evmAddress, profile) => {
      const nonce = await walletNonce.mutateAsync();
      const signature = await walletSignMessage(nonce.message);
      const resp = await signupMutation.mutateAsync({
        ...withProfile(profile, null),
        evm_address: evmAddress,
        signature,
        message: nonce.message,
      });
      signIn(resp);
    },
  };
}
