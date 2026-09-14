/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "1" for the Tauri (Android/iOS) build; see vite.config.ts. */
  readonly VITE_TAURI?: string;
  /** API origin the Tauri build calls through the native `api_request` command. */
  readonly VITE_MOBILE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
