/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "1" for the Tauri (Android/iOS) build; see vite.config.ts. */
  readonly VITE_TAURI?: string;
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
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
