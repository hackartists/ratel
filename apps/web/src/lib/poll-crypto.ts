import type { Answer, VoteEncryptionMaterialResponse, VoteVerificationMaterialResponse } from "@ratel/ts-bridges";

// app/ratel/src/features/spaces/pages/actions/actions/poll/services/{client_vote_encryption,client_vote_verification}.rs
//
// KNOWN GAP: the Rust client links `packages/attr-voting` (a CP-ABE crate,
// `rabe`) directly into the Dioxus WASM binary — there is no separate
// wasm-pack/npm build of it this port can call, and building one requires
// `cargo`/`wasm-pack`, which this migration's tooling does not run. Every
// function below therefore mirrors the Rust code's own "unsupported
// platform" fallback (the `#[cfg(not(any(feature = "web", feature =
// "server")))]` branch used today for mobile/Tauri, where `attr-voting` is
// also unavailable) rather than reimplementing attribute-based encryption
// from scratch in TypeScript, which would be both a large undertaking and a
// security risk if done incorrectly. The poll UI still renders the full
// encrypted-vote flow (secret prompt, verification panel); only the actual
// encrypt/decrypt calls refuse. Follow-up: port `attr-voting` to wasm-pack
// and call it from here.
const UNSUPPORTED = "Encrypted voting is not supported in this build (no browser ABE implementation yet).";

export interface ClientEncryptedVote {
  voter_tag: string;
  ciphertext_json: string;
}

export interface StoredVoterKey {
  version: number;
  poll_id: string;
  voter_tag: string;
  key_bundle_json: string;
}

export interface ClientVoteVerification {
  voter_tag: string;
  ciphertext_hash: string;
  decrypted_choice: string;
  decrypted_metadata: unknown;
}

const STORAGE_KEY_PREFIX = "ratel.voteKey.";
const SESSION_SECRET_KEY = "ratel.voteSecret.session";

export function voterKeyStorageKey(pollId: string): string {
  return `${STORAGE_KEY_PREFIX}${pollId}`;
}

export function encryptAnswersForCanister(
  _material: VoteEncryptionMaterialResponse,
  _answers: Answer[],
  _submittedAtMs: number,
): ClientEncryptedVote {
  throw new Error(UNSUPPORTED);
}

export function buildStoredVoterKeyFromEncryptionMaterial(
  _material: VoteEncryptionMaterialResponse,
  userSecret: string,
): StoredVoterKey {
  if (userSecret === "") throw new Error("Secret is required");
  throw new Error(UNSUPPORTED);
}

export function buildStoredVoterKey(_material: VoteVerificationMaterialResponse, userSecret: string): StoredVoterKey {
  if (userSecret === "") throw new Error("Secret is required");
  throw new Error(UNSUPPORTED);
}

export function verifyClientVoteMaterial(
  material: VoteVerificationMaterialResponse,
  storedKey: StoredVoterKey,
  _userSecret: string,
): ClientVoteVerification {
  if (material.poll_id !== storedKey.poll_id || material.voter_tag !== storedKey.voter_tag) {
    throw new Error("Stored key does not match this vote");
  }
  throw new Error(UNSUPPORTED);
}

export function saveStoredVoterKey(record: StoredVoterKey): void {
  try {
    window.localStorage.setItem(voterKeyStorageKey(record.poll_id), JSON.stringify(record));
  } catch {
    // Storage may be unavailable (private mode); non-fatal.
  }
}

export function loadStoredVoterKey(pollId: string): StoredVoterKey | null {
  try {
    const raw = window.localStorage.getItem(voterKeyStorageKey(pollId));
    return raw === null ? null : (JSON.parse(raw) as StoredVoterKey);
  } catch {
    return null;
  }
}

export function loadSessionVoteSecret(): string | null {
  try {
    return window.sessionStorage.getItem(SESSION_SECRET_KEY);
  } catch {
    return null;
  }
}

export function saveSessionVoteSecret(userSecret: string): void {
  try {
    window.sessionStorage.setItem(SESSION_SECRET_KEY, userSecret);
  } catch {
    // Non-fatal.
  }
}
