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
