//! Thin `wasm-bindgen` shim around `packages/attr-voting`'s CP-ABE vote
//! encryption so the React app (`apps/web`) can encrypt poll votes exactly
//! as the Dioxus app does.
//!
//! Mirrors `attr_voting::vote::encrypt_vote_json_with_pk_json`, which
//! `app/ratel/src/features/spaces/pages/actions/actions/poll/services/client_vote_encryption.rs`
//! (`encrypt_answers_for_canister`) calls from the Dioxus web build.

use attr_voting::types::VotePayload;
use wasm_bindgen::prelude::*;

/// Encrypt a vote payload for the canister using CP-ABE (rabe's BSW scheme).
///
/// `payload_json` must deserialize into `attr_voting::types::VotePayload`
/// (`{ "choice": string, "metadata": <json value> | null }`). Returns the
/// ciphertext serialized as JSON (`attr_voting::vote::EncryptedVote`), ready
/// to ship to the server as-is.
#[wasm_bindgen]
pub fn encrypt_vote_json_with_pk_json(
    public_key_json: &str,
    voter_id: &str,
    payload_json: &str,
) -> Result<String, JsValue> {
    let payload: VotePayload = serde_json::from_str(payload_json)
        .map_err(|e| JsValue::from_str(&format!("invalid payload_json: {e}")))?;

    attr_voting::vote::encrypt_vote_json_with_pk_json(public_key_json, voter_id, &payload)
        .map_err(|e| JsValue::from_str(&format!("ABE encrypt failed: {e}")))
}

/// Decrypt a CP-ABE encrypted vote using the voter's ABE secret key.
///
/// Mirrors `attr_voting::decrypt_vote_json_with_key_json` (re-exported at
/// the crate root from `vote.rs`), which
/// `app/ratel/src/features/spaces/pages/actions/actions/poll/services/client_vote_verification.rs`
/// (`verify_client_vote_material`) calls from the Dioxus web build.
/// `secret_key_json` must deserialize into `attr_voting`'s `CpAbeSecretKey`
/// (as produced by `VotingAuthority::serialize_key`, and unwrapped from a
/// `StoredVoterKey` bundle via `key_vault::unwrap_secret_key`).
/// `encrypted_vote_json` accepts both the wrapped `EncryptedVote` shape and
/// the raw `CpAbeCiphertext` shape (see `EncryptedVote::from_json`). Returns
/// the decrypted `VotePayload` serialized as JSON
/// (`{ "choice": string, "metadata": <json value> | null }`).
#[wasm_bindgen]
pub fn decrypt_vote_json_with_key_json(
    secret_key_json: &str,
    encrypted_vote_json: &str,
) -> Result<String, JsValue> {
    let payload: VotePayload =
        attr_voting::decrypt_vote_json_with_key_json(secret_key_json, encrypted_vote_json)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

    serde_json::to_string(&payload)
        .map_err(|e| JsValue::from_str(&format!("failed to serialize payload: {e}")))
}
