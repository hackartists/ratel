import type { SpaceIncentiveToken } from "@ratel/ts-bridges";

// app/ratel/src/features/spaces/pages/apps/apps/incentive_pool/utils/format.rs.

/** Rust `option_env!("ENV")` → the Vite build's `VITE_ENV` (default "local"). */
export function buildEnv(): string {
  return (import.meta.env as unknown as Record<string, string | undefined>).VITE_ENV ?? "local";
}

/** `usdt_tokens`. */
export function usdtTokens(tokens: SpaceIncentiveToken[]): SpaceIncentiveToken[] {
  return tokens.filter((t) => t.symbol.toLowerCase() === "usdt");
}

/** `default_usdt_token_address`. */
export function defaultUsdtTokenAddress(tokens: SpaceIncentiveToken[]): string | null {
  return usdtTokens(tokens)[0]?.token_address ?? null;
}

/** `is_valid_usdt_input`: empty, ".", or a non-negative decimal with at most one dot. */
export function isValidUsdtInput(value: string): boolean {
  if (value === "") return true;
  let dots = 0;
  for (const c of value) {
    if (c === ".") {
      dots += 1;
      if (dots > 1) return false;
      continue;
    }
    if (c < "0" || c > "9") return false;
  }
  if (value === ".") return true;
  const n = Number(value);
  return !Number.isNaN(n) && n >= 0;
}

function withThousandsSeparator(value: string): string {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function trimFraction(fraction: string): string {
  let f = fraction.replace(/0+$/, "");
  if (f.length > 2) f = f.slice(0, 2).replace(/0+$/, "");
  return f;
}

/** `format_token_balance`: a raw integer balance scaled by `decimals`, 2 fraction digits max. */
export function formatTokenBalance(balance: string, decimals: number): string {
  if (balance === "" || !/^\d+$/.test(balance)) return "0";
  const d = Math.max(decimals, 0);
  const normalized = balance.replace(/^0+/, "");
  if (normalized === "") return "0";
  if (d === 0) return withThousandsSeparator(normalized);

  if (normalized.length <= d) {
    const fraction = trimFraction(normalized.padStart(d, "0"));
    return fraction === "" ? "0" : `0.${fraction}`;
  }

  const split = normalized.length - d;
  const whole = withThousandsSeparator(normalized.slice(0, split));
  const fraction = trimFraction(normalized.slice(split));
  return fraction === "" ? whole : `${whole}.${fraction}`;
}

/** `incentive_explorer_url`. */
export function incentiveExplorerUrl(address: string): string | null {
  const trimmed = address.trim();
  if (trimmed === "") return null;
  const env = buildEnv();
  const base = env === "prod" || env === "production" ? "https://kaiascan.io" : "https://kairos.kaiascan.io";
  return `${base}/address/${trimmed}`;
}
