import { signAttributesHandler } from "@ratel/ts-bridges";
import type { CredentialResponse } from "@ratel/ts-bridges";
import { requestCredentialIdentityVerification } from "@/lib/portone-identity";

// Rust `verify_identity` (the former credentials interop): PortOne identity
// verification (`@/lib/portone-identity`), then `sign_attributes_handler(PortOne { id })`.
//
// Build-time switches, the Vite equivalents of the Rust compile-time config:
//   VITE_BYPASS=true                  — `cfg(feature = "bypass")`: skip PortOne and sign an empty id
//                                       (the local/testing backend accepts it).
//   VITE_PORTONE_STORE_ID             — `PORTONE_STORE_ID`
//   VITE_PORTONE_INICIS_CHANNEL_KEY   — `PORTONE_INICIS_CHANNEL_KEY`

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

  let value: unknown;
  try {
    value = await requestCredentialIdentityVerification(storeId, channelKey, prefix);
  } catch (e) {
    console.error("Failed to request identity verification:", e);
    throw new IdentityVerificationError("PortOneRequestFailure");
  }
  if (typeof value !== "string") throw new IdentityVerificationError("PortOneInicisInvalidIdentity");
  return signAttributesHandler({ type: "port_one", id: value });
}
