/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "1" for the Tauri (Android/iOS) build; see vite.config.ts. */
  readonly VITE_TAURI?: string;
  /**
   * "true" for testing builds against a `bypass` backend — Rust
   * `cfg(feature = "bypass")`: identity verification skips PortOne and signs an
   * empty id (see src/lib/identity-verification.ts). Never set for real deployments.
   */
  readonly VITE_BYPASS?: string;
  /** API origin the Tauri build calls through the native `api_request` command. */
  readonly VITE_MOBILE_API_URL?: string;
  /** Rust `WalletConnectConfig` (`WALLETCONNECT_PROJECT_ID`); see components/auth/interop.ts. */
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
  /** Rust `FirebaseConfig` (`FIREBASE_*`) for Google sign-in on the web. */
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string;
  /** PortOne store id (Rust `option_env!("PORTONE_STORE_ID")`); see src/lib/portone.ts. */
  readonly VITE_PORTONE_STORE_ID?: string;
  /** PortOne INICIS channel key (Rust `option_env!("PORTONE_INICIS_CHANNEL_KEY")`). */
  readonly VITE_PORTONE_INICIS_CHANNEL_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
