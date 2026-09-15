// PortOne store / channel settings for the browser SDK calls
// (`window.PortOne.requestIdentityVerification`, wrapped by
// `@/lib/portone-identity`). The SDK script itself is loaded once, globally,
// from index.html (vite.config.ts `legacyHead`).
//
// Rust bakes these in at compile time with `option_env!`; the React build
// reads the same names with Vite's `VITE_` prefix, so the build environment
// must export `VITE_PORTONE_STORE_ID` / `VITE_PORTONE_INICIS_CHANNEL_KEY`
// wherever it exports `PORTONE_STORE_ID` / `PORTONE_INICIS_CHANNEL_KEY` today.

/** The raw build-time values (`option_env!`), `undefined` when unset. */
export const portoneEnv = {
  storeId: import.meta.env.VITE_PORTONE_STORE_ID as string | undefined,
  inicisChannelKey: import.meta.env.VITE_PORTONE_INICIS_CHANNEL_KEY as string | undefined,
};

/**
 * `PortoneConfig::default()` (app/ratel/src/common/config/portone_config.rs):
 * the values with the Rust placeholder fallbacks.
 */
export const portoneConfig = {
  storeId: portoneEnv.storeId ?? "your_default_store_id",
  inicisChannelKey: portoneEnv.inicisChannelKey ?? "your_default_inicis_channel_key",
};
