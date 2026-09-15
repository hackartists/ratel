// app/ratel/src/features/social/pages/dao/{config.rs, interop/mod.rs,
// models/dao_contract.rs} and the clipboard / external-link helpers of
// components/dao_info_card.rs, as plain async functions.
//
// The Rust interop is a `wasm_bindgen` extern on
// `window.ratel.ratel_team_dao.{createDAO, copyText}` (interop/mod.rs:6); these
// functions call exactly that path. A missing namespace throws inside the
// `try`, like the `catch` shim wasm_bindgen generates.

/** Rust `Config::default()` (config.rs) — `option_env!` values baked in at build time. */
const ENV = import.meta.env as unknown as Record<string, string | undefined>;

export const DAO_CONFIG = {
  rpcUrl: ENV.VITE_KAIA_ENDPOINT ?? "https://public-en-kairos.node.kaia.io",
  blockExplorerUrl: ENV.VITE_BLOCK_EXPLORER_URL ?? "https://kairos.kaiascan.io",
};

/** `Environment::default()` (`option_env!("ENV")`, "local" when unset) → admin_page.rs `network`. */
function isProduction(): boolean {
  const env = (ENV.VITE_ENV ?? "local").toLowerCase();
  return env === "prod" || env === "production";
}

export const DAO_NETWORK: "mainnet" | "testnet" = isProduction() ? "mainnet" : "testnet";

/** Rust `cfg(feature = "tauri-web")` — the Tauri (Android/iOS) bundle. */
const IS_TAURI_WEB = import.meta.env.VITE_TAURI === "1";

/** Rust `CreateDaoResult` (serde renames `daoAddress` / `transactionHash`). */
export interface CreateDaoResult {
  daoAddress: string;
  transactionHash: string;
}

/** Rust `DaoWalletError`. */
export class DaoWalletError extends Error {
  constructor(
    public readonly code: string | null,
    message: string,
  ) {
    super(message);
    this.name = "DaoWalletError";
  }
}

interface TeamDaoGlobal {
  initialize(config: unknown): void;
  createDAO(admins: string[], network: string, rpcUrl: string, blockExplorerUrl: string): Promise<unknown>;
  copyText(text: string): Promise<unknown>;
}

const teamDao = (): TeamDaoGlobal =>
  (window as unknown as { ratel: { ratel_team_dao: TeamDaoGlobal } }).ratel.ratel_team_dao;

/** Rust `format_js_error` (dao_contract.rs). */
function formatJsError(err: unknown): DaoWalletError {
  const isObject = typeof err === "object" && err !== null;
  const codeValue = isObject ? (err as { code?: unknown }).code : undefined;
  const code = typeof codeValue === "string" ? codeValue : null;

  let message: string;
  if (typeof err === "string") {
    message = err;
  } else if (isObject) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === "string") {
      message = msg;
    } else {
      let json: unknown;
      try {
        json = JSON.stringify(err);
      } catch {
        json = undefined;
      }
      message = typeof json === "string" ? json : "Unknown error";
    }
  } else {
    message = "Unknown error";
  }
  return new DaoWalletError(code, message);
}

/** Rust `create_dao` (dao_contract.rs, web build). */
export async function createDao(
  admins: string[],
  network: string,
  rpcUrl: string,
  blockExplorerUrl: string,
): Promise<CreateDaoResult> {
  let value: unknown;
  try {
    value = await teamDao().createDAO([...admins], network, rpcUrl, blockExplorerUrl);
  } catch (e) {
    throw formatJsError(e);
  }

  // serde_wasm_bindgen::from_value::<CreateDaoResult>
  const result = value as Partial<CreateDaoResult> | null | undefined;
  if (typeof result !== "object" || result === null) {
    throw new DaoWalletError(null, `Invalid DAO response: invalid type: ${String(value)}, expected struct CreateDaoResult`);
  }
  if (typeof result.daoAddress !== "string") {
    throw new DaoWalletError(null, "Invalid DAO response: missing field `daoAddress`");
  }
  if (typeof result.transactionHash !== "string") {
    throw new DaoWalletError(null, "Invalid DAO response: missing field `transactionHash`");
  }
  return { daoAddress: result.daoAddress, transactionHash: result.transactionHash };
}

/**
 * Rust `copy_to_clipboard` (dao_info_card.rs). Only the plain web build has
 * `feature = "web"`; the Tauri bundle returns an error without copying.
 */
export async function copyToClipboard(text: string): Promise<void> {
  if (IS_TAURI_WEB) throw new Error("Clipboard is only available on web");
  await teamDao().copyText(text);
}

/** Rust `after_copy_delay` — 2s on the web build, none elsewhere. */
export function afterCopyDelay(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, IS_TAURI_WEB ? 0 : 2000));
}

/** Whether the explorer link is opened through the native bridge (Rust `cfg(feature = "tauri-web")`). */
export function opensExternalUrlNatively(): boolean {
  return IS_TAURI_WEB;
}

/**
 * Rust `crate::tauri::open(&ExternalUrlRequest { url })` — tauri-common's
 * `invoke("open_external_url", args)` through `window.__TAURI__.core.invoke`.
 * Failures are only logged, like `crate::error!`.
 */
export async function openExternalUrl(url: string): Promise<void> {
  try {
    const tauri = (window as unknown as {
      __TAURI__: { core: { invoke(cmd: string, args?: unknown): Promise<unknown> } };
    }).__TAURI__;
    await tauri.core.invoke("open_external_url", { url });
  } catch (e) {
    console.error(`open_external_url failed: ${String(e)}`);
  }
}
