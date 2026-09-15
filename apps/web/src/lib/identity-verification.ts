import { signAttributesHandler } from "@ratel/ts-bridges";
import type { CredentialResponse } from "@ratel/ts-bridges";

// app/ratel/src/features/social/pages/credentials/interop/mod.rs `verify_identity`:
// PortOne identity verification through `window.ratel.user_credential`
// (ratel-app-shell.js, loaded globally), then `sign_attributes_handler(PortOne { id })`.
//
// Build-time switches, the Vite equivalents of the Rust compile-time config:
//   VITE_BYPASS=true                  — `cfg(feature = "bypass")`: skip PortOne and sign an empty id
//                                       (the local/testing backend accepts it).
//   VITE_PORTONE_STORE_ID             — `PORTONE_STORE_ID`
//   VITE_PORTONE_INICIS_CHANNEL_KEY   — `PORTONE_INICIS_CHANNEL_KEY`

interface UserCredentialGlobals {
  request_identity_verification(storeId: string, channelKey: string, prefix: string): Promise<unknown>;
}

export class IdentityVerificationError extends Error {
  constructor(public readonly variant: "PortOneRequestFailure" | "PortOneInicisInvalidIdentity") {
    super(variant);
    this.name = "IdentityVerificationError";
  }
}

export const PORTONE_STORE_ID: string = import.meta.env.VITE_PORTONE_STORE_ID ?? "your_default_store_id";
export const PORTONE_INICIS_CHANNEL_KEY: string =
  import.meta.env.VITE_PORTONE_INICIS_CHANNEL_KEY ?? "your_default_inicis_channel_key";
const BYPASS = import.meta.env.VITE_BYPASS === "true";

export async function verifyIdentity(storeId: string, channelKey: string, prefix: string): Promise<CredentialResponse> {
  if (BYPASS) return signAttributesHandler({ type: "port_one", id: "" });

  const globals = (window as unknown as { ratel?: { user_credential?: UserCredentialGlobals } }).ratel?.user_credential;
  let value: unknown;
  try {
    if (!globals) throw new Error("window.ratel.user_credential is not loaded");
    value = await globals.request_identity_verification(storeId, channelKey, prefix);
  } catch (e) {
    console.error("Failed to request identity verification:", e);
    throw new IdentityVerificationError("PortOneRequestFailure");
  }
  if (typeof value !== "string") throw new IdentityVerificationError("PortOneInicisInvalidIdentity");
  return signAttributesHandler({ type: "port_one", id: value });
}
