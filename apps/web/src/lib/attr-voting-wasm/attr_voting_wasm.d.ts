/* tslint:disable */
/* eslint-disable */

/**
 * Decrypt a CP-ABE encrypted vote using the voter's ABE secret key.
 *
 * Mirrors `attr_voting::decrypt_vote_json_with_key_json` (re-exported at
 * the crate root from `vote.rs`), which
 * `app/ratel/src/features/spaces/pages/actions/actions/poll/services/client_vote_verification.rs`
 * (`verify_client_vote_material`) calls from the Dioxus web build.
 * `secret_key_json` must deserialize into `attr_voting`'s `CpAbeSecretKey`
 * (as produced by `VotingAuthority::serialize_key`, and unwrapped from a
 * `StoredVoterKey` bundle via `key_vault::unwrap_secret_key`).
 * `encrypted_vote_json` accepts both the wrapped `EncryptedVote` shape and
 * the raw `CpAbeCiphertext` shape (see `EncryptedVote::from_json`). Returns
 * the decrypted `VotePayload` serialized as JSON
 * (`{ "choice": string, "metadata": <json value> | null }`).
 */
export function decrypt_vote_json_with_key_json(secret_key_json: string, encrypted_vote_json: string): string;

/**
 * Encrypt a vote payload for the canister using CP-ABE (rabe's BSW scheme).
 *
 * `payload_json` must deserialize into `attr_voting::types::VotePayload`
 * (`{ "choice": string, "metadata": <json value> | null }`). Returns the
 * ciphertext serialized as JSON (`attr_voting::vote::EncryptedVote`), ready
 * to ship to the server as-is.
 */
export function encrypt_vote_json_with_pk_json(public_key_json: string, voter_id: string, payload_json: string): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly decrypt_vote_json_with_key_json: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly encrypt_vote_json_with_pk_json: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
