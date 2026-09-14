// Client-side encrypted-voting support for the poll viewer
// (`pages/spaces/[spaceId]/components/poll-viewer/poll-viewer.tsx`).
//
// Ports:
//   - packages/attr-voting/src/key_vault.rs (`wrap_secret_key`/`unwrap_secret_key`)
//     — PBKDF2-SHA256 + AES-256-GCM session-key wrapping. Pure WebCrypto,
//     no new dependency needed.
//   - features/spaces/pages/actions/actions/poll/services/client_vote_encryption.rs
//     (`build_stored_voter_key_from_encryption_material`) — wraps the
//     wrapping above with the poll's `VoteEncryptionMaterialResponse`.
//   - features/spaces/pages/actions/actions/poll/services/client_vote_verification.rs
//     (`save_stored_voter_key`, `load_session_vote_secret`,
//     `save_session_vote_secret`) — localStorage/sessionStorage bookkeeping,
//     same storage keys as Rust so a future full port reads back the same
//     records.
//   - `attr_voting::vote::encrypt_vote_json_with_pk_json`, which
//     `client_vote_encryption.rs::encrypt_answers_for_canister` calls. That
//     function is Ciphertext-Policy Attribute-Based Encryption (the `rabe`
//     crate's BSW scheme, over the `rabe-bn` pairing-friendly curve — real
//     bilinear-pairing cryptography, not a symmetric primitive WebCrypto
//     exposes). Rather than reimplementing BN-curve pairings + CP-ABE in
//     TypeScript, `packages/attr-voting` is compiled to wasm via a thin
//     `wasm-bindgen` shim crate (`packages/attr-voting-wasm`) and the
//     generated `.js`/`.wasm` pair is checked into
//     `./attr-voting-wasm/` (regenerate with
//     `make -C app/ratel gen-attr-voting-wasm`). `encryptAnswersForCanister`
//     below calls into that wasm module — see `encryptVoteJsonWithPkJson`.

import type { Answer, VoteEncryptionMaterialResponse } from "@ratel/ts-bridges";
import init, { encrypt_vote_json_with_pk_json } from "./attr-voting-wasm/attr_voting_wasm";
import wasmUrl from "./attr-voting-wasm/attr_voting_wasm_bg.wasm?url";

/** Rust `attr_voting::vote::ClientEncryptedVote`. */
export interface ClientEncryptedVote {
  voter_tag: string;
  ciphertext_json: string;
}

const KDF_NAME = "PBKDF2-SHA256";
const CIPHER_NAME = "AES-256-GCM";
const ITERATIONS = 310_000;
const KEY_LEN_BITS = 256;
const SALT_LEN = 16;
const NONCE_LEN = 12;
const BUNDLE_VERSION = 1;

const STORAGE_KEY_PREFIX = "ratel.voteKey.";
const SESSION_SECRET_KEY = "ratel.voteSecret.session";

/** Rust `attr_voting::key_vault::EncryptedSecretKeyBundle`. */
export interface EncryptedSecretKeyBundle {
  version: number;
  kdf: string;
  iterations: number;
  cipher: string;
  salt: string;
  nonce: string;
  ciphertext: string;
}

/** Rust `StoredVoterKey` (client_vote_verification.rs). */
export interface StoredVoterKey {
  version: number;
  poll_id: string;
  voter_tag: string;
  key_bundle_json: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveAesKey(userSecret: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(userSecret), { name: "PBKDF2" }, false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: KEY_LEN_BITS },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Rust `attr_voting::key_vault::wrap_secret_key`. */
export async function wrapSecretKey(userSecret: string, secretKeyJson: string): Promise<string> {
  if (userSecret === "") throw new Error("Secret is required");
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_LEN));
  const key = await deriveAesKey(userSecret, salt);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, new TextEncoder().encode(secretKeyJson));
  const bundle: EncryptedSecretKeyBundle = {
    version: BUNDLE_VERSION,
    kdf: KDF_NAME,
    iterations: ITERATIONS,
    cipher: CIPHER_NAME,
    salt: bytesToBase64(salt),
    nonce: bytesToBase64(nonce),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
  return JSON.stringify(bundle);
}

/** Rust `attr_voting::key_vault::unwrap_secret_key`. */
export async function unwrapSecretKey(userSecret: string, bundleJson: string): Promise<string> {
  const bundle: EncryptedSecretKeyBundle = JSON.parse(bundleJson);
  if (bundle.version !== BUNDLE_VERSION || bundle.kdf !== KDF_NAME || bundle.iterations !== ITERATIONS || bundle.cipher !== CIPHER_NAME) {
    throw new Error("unwrapSecretKey: bundle format mismatch");
  }
  const salt = base64ToBytes(bundle.salt);
  const nonce = base64ToBytes(bundle.nonce);
  const ciphertext = base64ToBytes(bundle.ciphertext);
  if (salt.length !== SALT_LEN || nonce.length !== NONCE_LEN) throw new Error("unwrapSecretKey: invalid salt/nonce length");
  const key = await deriveAesKey(userSecret, salt);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}

/** Rust `build_stored_voter_key_from_encryption_material` (client_vote_encryption.rs). */
export async function buildStoredVoterKeyFromEncryptionMaterial(
  material: VoteEncryptionMaterialResponse,
  userSecret: string,
): Promise<StoredVoterKey> {
  if (userSecret === "") throw new Error("Secret is required");
  const keyBundleJson = await wrapSecretKey(userSecret, material.voter_secret_key_json);
  return { version: 1, poll_id: material.poll_id, voter_tag: material.voter_tag, key_bundle_json: keyBundleJson };
}

/** Rust `voter_key_storage_key`. */
function voterKeyStorageKey(pollId: string): string {
  return `${STORAGE_KEY_PREFIX}${pollId}`;
}

/** Rust `save_stored_voter_key` (localStorage — persists across sessions for later verification). */
export function saveStoredVoterKey(record: StoredVoterKey): void {
  try {
    window.localStorage.setItem(voterKeyStorageKey(record.poll_id), JSON.stringify(record));
  } catch {
    // Storage unavailable (private mode, quota) — same swallow-and-continue as Rust.
  }
}

/** Rust `load_stored_voter_key`. */
export function loadStoredVoterKey(pollId: string): StoredVoterKey | null {
  try {
    const raw = window.localStorage.getItem(voterKeyStorageKey(pollId));
    return raw === null ? null : (JSON.parse(raw) as StoredVoterKey);
  } catch {
    return null;
  }
}

/** Rust `load_session_vote_secret` (sessionStorage — cleared when the tab closes). */
export function loadSessionVoteSecret(): string | null {
  try {
    return window.sessionStorage.getItem(SESSION_SECRET_KEY);
  } catch {
    return null;
  }
}

/** Rust `save_session_vote_secret`. */
export function saveSessionVoteSecret(userSecret: string): void {
  try {
    window.sessionStorage.setItem(SESSION_SECRET_KEY, userSecret);
  } catch {
    // Swallowed, same as Rust.
  }
}

/** Rust `attr_voting::types::VotePayload`, field-for-field. */
export interface VotePayload {
  choice: string;
  metadata: unknown | null;
}

/** Rust `ClientVotePayloadMetadata` (client_vote_encryption.rs, private). */
interface ClientVotePayloadMetadata {
  poll_id: string;
  submitted_at_ms: number;
}

let wasmInitPromise: Promise<void> | null = null;

/** Lazily initializes the `attr-voting-wasm` module (idempotent, shared across calls). */
function ensureWasmInit(): Promise<void> {
  if (wasmInitPromise === null) {
    wasmInitPromise = init(wasmUrl).then(() => undefined);
  }
  return wasmInitPromise;
}

/**
 * Rust `attr_voting::vote::encrypt_vote_json_with_pk_json`, called through
 * the `packages/attr-voting-wasm` wasm-bindgen shim. Encrypts `payload` with
 * CP-ABE (rabe's BSW scheme) under `publicKeyJson`, scoped to `voterId`, and
 * returns the ciphertext serialized as JSON
 * (`attr_voting::vote::EncryptedVote`), ready to ship to the server as-is.
 */
export async function encryptVoteJsonWithPkJson(publicKeyJson: string, voterId: string, payload: VotePayload): Promise<string> {
  await ensureWasmInit();
  return encrypt_vote_json_with_pk_json(publicKeyJson, voterId, JSON.stringify(payload));
}

/**
 * Rust `encrypt_answers_for_canister` (client_vote_encryption.rs). Builds
 * the same `VotePayload` (`choice` = JSON-serialized `answers`, `metadata` =
 * `{ poll_id, submitted_at_ms }`) and encrypts it under the poll's authority
 * public key, scoped to the voter's blind tag — matching the Dioxus web
 * build byte-for-byte (same JSON serialization, same ABE policy/attribute
 * derived from `voter_tag`).
 */
export async function encryptAnswersForCanister(material: VoteEncryptionMaterialResponse, answers: Answer[], submittedAtMs: number): Promise<ClientEncryptedVote> {
  const choice = JSON.stringify(answers);
  const metadata: ClientVotePayloadMetadata = { poll_id: material.poll_id, submitted_at_ms: submittedAtMs };
  const payload: VotePayload = { choice, metadata };

  const ciphertextJson = await encryptVoteJsonWithPkJson(material.authority_public_key_json, material.voter_tag, payload);

  return { voter_tag: material.voter_tag, ciphertext_json: ciphertextJson };
}
