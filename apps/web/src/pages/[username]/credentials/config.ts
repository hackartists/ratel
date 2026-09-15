// app/ratel/src/common/config/portone_config.rs (`PortoneConfig::default`): the
// client-visible PortOne identifiers used by the KYC flow below. Rust bakes
// these in at compile time via `option_env!`; Vite exposes the same
// `VITE_`-prefixed env vars through `import.meta.env` with the identical
// placeholder fallbacks (no real secret — `api_secret` stays server-only and
// is never read here).
export interface PortoneClientConfig {
  storeId: string;
  inicisChannelKey: string;
}

export function getPortoneConfig(): PortoneClientConfig {
  const env = import.meta.env as unknown as Record<string, string | undefined>;
  return {
    storeId: env.VITE_PORTONE_STORE_ID || "your_default_store_id",
    inicisChannelKey: env.VITE_PORTONE_INICIS_CHANNEL_KEY || "your_default_inicis_channel_key",
  };
}
